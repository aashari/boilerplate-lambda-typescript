import { AttributeValue, DescribeTableCommand, DynamoDBClient, ScanCommandInput, WriteRequest } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { inspect } from 'util';
import { statistic } from '../decorators/statistic.decorator';
import { chunk } from '../helpers/chunk.helper';
import { Model } from '../models/model';
import { DatadogLibrary } from './datadog.library';

interface BATCH_COMMAND {
    [key: string]: (Omit<WriteRequest, "PutRequest" | "DeleteRequest"> & {
        PutRequest?: any | undefined;
        DeleteRequest?: any | undefined;
    })[];
}

/**
 * DynamoDB library to interact with DynamoDB service, it can be used to create, update, delete, scan and query DynamoDB tables.
 * By default, the put and delete methods will be queued and executed in batches, this is to avoid the DynamoDB service from being overloaded.
 */
export class DynamoDBLibrary {

    private static dynamoDBLibrary: DynamoDBLibrary;

    private dynamoDBClient: DynamoDBClient;
    private documentClient: DynamoDBDocument;
    private dynamodbTableKey: { [tableName: string]: string[] } = {};

    private putCommandList: BATCH_COMMAND = {};
    private putCommandWaitingHandle: NodeJS.Timeout | undefined;

    private deleteCommandList: BATCH_COMMAND = {};
    private deleteCommandWaitingHandle: NodeJS.Timeout | undefined;

    constructor() { }

    public async initiateDatadogConfiguration() {
        this.dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'ap-southeast-1' });
        this.documentClient = DynamoDBDocument.from(this.dynamoDBClient);
    }

    public static async instance(): Promise<DynamoDBLibrary> {
        if (!DynamoDBLibrary.dynamoDBLibrary) DynamoDBLibrary.dynamoDBLibrary = new DynamoDBLibrary();
        await DynamoDBLibrary.dynamoDBLibrary.initiateDatadogConfiguration();
        console.info('[DynamoDBLibrary][instance] DynamoDBLibrary initialized and ready to use');
        return DynamoDBLibrary.dynamoDBLibrary;
    }

    private statisticHandler(tableName: string, method: string, data: any | undefined, errorResponse: any | undefined) {

        DatadogLibrary.queueMetric(`dynamodb.${method}`, 1, `count`, [
            `table:${tableName}`,
            `class:DynamoDBLibrary`,
            `method:${method}`,
            `status:${errorResponse ? `failure` : `success`}`
        ]);

        if (!errorResponse) return;

        // log the errror message to cloudwatch logs
        console.error(`[DynamoDBLibrary][${method}] DynamoDB ${method}.${tableName} execution error`, { errorResponse, data });

        // stream the error to datadog event
        DatadogLibrary.queueEvent(`DynamoDB ${method}.${tableName} execution error`, [
            `Table Name: ${tableName}`,
            `Table Data: ${JSON.stringify(data)}`,
            `Error: ${errorResponse}`,
            `Error Details: ${inspect(errorResponse)}`,
        ].join('\n'), "error", [`table:${tableName}`, `class:DynamoDBLibrary`, `method:${method}`]);
        
    }

    /**
     * Get the table key configuration for the table which should contains the primary key and the sort key 
     * @param tableName the DynamoDB table name
     * @returns Promise<string[]> the list of string contains the pre defined DynamoDB table key attribute name
     */
    @statistic()
    private static async getTableKey(tableName: string) {
        // check if the table key is already cached
        if (this.dynamoDBLibrary.dynamodbTableKey[tableName]) return this.dynamoDBLibrary.dynamodbTableKey[tableName];
        // generate empty string list
        let tableKey: string[] = [];
        // get the table description
        let tableDescription = await this.dynamoDBLibrary.dynamoDBClient.send(new DescribeTableCommand({ TableName: tableName }));
        // get all of the pre defined key attribute name
        tableDescription.Table?.KeySchema?.forEach((key) => {
            if (key.AttributeName) tableKey.push(key.AttributeName);
        });
        // cache the table key attribute name list
        this.dynamoDBLibrary.dynamodbTableKey[tableName] = tableKey;
        // return the table key attribute name list
        return tableKey;
    }

    /**
     * Get the item from the DynamoDB table by the primary key and the sort key (if available)
     * @param tableName the DynamoDB table name
     * @param key the primary key and the sort key (if available)
     * @returns Promise<Model | null> the item from the DynamoDB table
     */
    @statistic()
    public static async get(tableName: string, key: { [key: string]: string }): Promise<Model | null> {
        // check whether the item is still on the processing put queue
        // if exist, return the item from the queue
        if (this.dynamoDBLibrary.putCommandList[tableName]) {
            let currentPutList: BATCH_COMMAND[string] = this.dynamoDBLibrary.putCommandList[tableName];
            for (let keyName in key) currentPutList = currentPutList.filter((item) => item.PutRequest.Item[keyName] === key[keyName]);
            if (currentPutList.length > 0) return currentPutList[0].PutRequest.Item;
        }

        // error response record
        let errorResponse: any | undefined = undefined;

        // if not exist, get the item from the table, and return the item
        return this.dynamoDBLibrary.documentClient.get({
            TableName: tableName, Key: key,
        }).then((result) => {
            return result.Item ? result.Item as any : null;
        }).catch(err => {
            errorResponse = err;
            return null;
        }).finally(() => {
            this.dynamoDBLibrary.statisticHandler(tableName, 'get', key, errorResponse);
        })
    }

    /**
     * Put the item into the DynamoDB table by the primary key and the sort key (if available)
     * @param tableName the DynamoDB table name
     * @param data the item to be put into the DynamoDB table
     * @param isQueue whether the put operation should be queued
     * @returns Promise<boolean> whether the put operation is successful
     */
    @statistic()
    public static async put(tableName: string, data: Model, isQueue: boolean = true): Promise<boolean> {

        if (!isQueue) {
            // error response record
            let errorResponse: any | undefined = undefined;
            // put the item into the table, and return the result
            return this.dynamoDBLibrary.documentClient.put({
                TableName: tableName, Item: data,
            }).then((result) => {
                return result.$metadata.httpStatusCode === 200 ? true : false;
            }).catch(err => {
                errorResponse = err;
                return false;
            }).finally(() => {
                this.dynamoDBLibrary.statisticHandler(tableName, 'put', data, errorResponse);
            });
        }

        // generate queue for put command
        if (!this.dynamoDBLibrary.putCommandList[tableName]) this.dynamoDBLibrary.putCommandList[tableName] = [];
        this.dynamoDBLibrary.putCommandList[tableName].push({ PutRequest: { Item: data } });

        // if there's existing waiting to publish, cancel it
        if (this.dynamoDBLibrary.putCommandWaitingHandle) {
            clearTimeout(this.dynamoDBLibrary.putCommandWaitingHandle);
        }

        // if there's no metrics queued for 300ms, publish them
        this.dynamoDBLibrary.putCommandWaitingHandle = setTimeout(() => {
            if (!tableName) return;
            let currentPutList: BATCH_COMMAND[string] = JSON.parse(JSON.stringify(this.dynamoDBLibrary.putCommandList[tableName]));
            this.dynamoDBLibrary.putCommandList[tableName] = [];
            let chunkedList = chunk(currentPutList, 25) as BATCH_COMMAND[string][];
            for (let currentChunk of chunkedList) {
                this.batchPutQueueByTable(tableName, currentChunk);
            }
        }, 300);

        // successfully queued write command
        return true;

    }

    /**
     * Delete the item from the DynamoDB table by the primary key and the sort key (if available)
     * @param tableName  the DynamoDB table name
     * @param data the item to be deleted from the DynamoDB table
     * @param isQueue whether the delete operation should be queued
     * @returns Promise<boolean> whether the delete operation is successful
     */
    @statistic()
    public static async delete(tableName: string, data: Model | { [key: string]: string }, isQueue: boolean = true): Promise<boolean> {

        let key = {};
        let tableKey = await this.getTableKey(tableName);
        tableKey.forEach((keyName) => key[keyName] = data[keyName]);

        if (!isQueue) {
            // error response record
            let errorResponse: any | undefined = undefined;
            // delete the item from the table, and return the result
            return this.dynamoDBLibrary.documentClient.delete({
                TableName: tableName, Key: key,
            }).then((result) => {
                return result.$metadata.httpStatusCode === 200 ? true : false;
            }).catch(err => {
                errorResponse = err;
                return false;
            }).finally(() => {
                this.dynamoDBLibrary.statisticHandler(tableName, 'delete', key, errorResponse);
            });
        }

        // generate queue for delete command
        if (!this.dynamoDBLibrary.deleteCommandList[tableName]) this.dynamoDBLibrary.deleteCommandList[tableName] = [];
        this.dynamoDBLibrary.deleteCommandList[tableName].push({ DeleteRequest: { Key: key } });

        // if there's existing waiting to publish, cancel it
        if (this.dynamoDBLibrary.deleteCommandWaitingHandle) {
            clearTimeout(this.dynamoDBLibrary.deleteCommandWaitingHandle);
        }

        // if there's no metrics queued for 300ms, publish them
        this.dynamoDBLibrary.deleteCommandWaitingHandle = setTimeout(() => {
            if (!tableName) return;
            let currentDeleteList: BATCH_COMMAND[string] = JSON.parse(JSON.stringify(this.dynamoDBLibrary.deleteCommandList[tableName]));
            this.dynamoDBLibrary.deleteCommandList[tableName] = [];
            let chunkedList = chunk(currentDeleteList, 25) as BATCH_COMMAND[string][];
            for (let currentChunk of chunkedList) {
                this.batchDeleteQueueByTable(tableName, currentChunk);
            }
        }, 300);

        // successfully queued write command
        return true;

    }

    /**
     * Scan the items from the DynamoDB table
     * @param tableName the DynamoDB table name
     * @param filter the filter to be applied to the scan operation
     * @param operand the operand to be applied to the filter
     * @returns Promise<Model[]> the items from the DynamoDB table
     */
    @statistic()
    public static async scan(tableName: string, filter: { [key: string]: string } | undefined = undefined, operand: string = 'AND'): Promise<Model[]> {
        let resultData: Model[] = [];
        let lastEvaluatedKey: { [key: string]: AttributeValue } | undefined;
        while (true) {
            let params: ScanCommandInput = {
                TableName: tableName,
                ExclusiveStartKey: lastEvaluatedKey,
            }
            if (filter) {
                params.FilterExpression = Object.keys(filter).map((key) => `contains(#${key}, :${key})`).join(` ${operand} `);
                params.ExpressionAttributeNames = Object.keys(filter).reduce((acc, key) => {
                    acc[`#${key}`] = key;
                    return acc;
                }, {});
                params.ExpressionAttributeValues = Object.keys(filter).reduce((acc, key) => {
                    acc[`:${key}`] = filter[key];
                    return acc;
                }, {})
            }
            // error response record
            let errorResponse: any | undefined = undefined;
            // scan the items from the table, and return the result
            let isSuccess = await this.dynamoDBLibrary.documentClient.scan(params).then((result) => {
                lastEvaluatedKey = result.LastEvaluatedKey;
                resultData = resultData.concat(result.Items as Model[]);
                return result.$metadata.httpStatusCode === 200 ? true : false;
            }).catch(err => {
                errorResponse = err;
                return false;
            }).finally(() => {
                this.dynamoDBLibrary.statisticHandler(tableName, 'scan', { filter, params }, errorResponse);
            });
            if (!isSuccess) break;
            if (!lastEvaluatedKey) break;
        }
        return resultData;
    }

    /**
     * Batch put the items into the DynamoDB table
     * @param tableName the DynamoDB table name
     * @param currentPutList the list of items to be put into the DynamoDB table
     * @returns Promise<boolean> whether the put operation is successful
     */
    @statistic()
    private static async batchPutQueueByTable(tableName: string, currentPutList: BATCH_COMMAND[string]) {

        let tableKey = await this.getTableKey(tableName);
        let uniquePutList: BATCH_COMMAND[string] = [];

        currentPutList = currentPutList.reverse();
        currentPutList.forEach((item) => {
            let isUnique: boolean[] = [];
            tableKey.forEach((keyName) => {
                if (uniquePutList.find((uniqueItem) => uniqueItem.PutRequest.Item[keyName] === item.PutRequest.Item[keyName])) isUnique.push(false);
            });
            if (isUnique.length != tableKey.length) uniquePutList.push(item);
        });

        if (uniquePutList.length === 0) return false;
        // error response record
        let errorResponse: any | undefined = undefined;
        // batch put the items into the table, and return the result
        return this.dynamoDBLibrary.documentClient.batchWrite({
            RequestItems: { [tableName]: uniquePutList },
        }).then((result) => {
            console.info(`[dynamodblibrary][batchPutQueueByTable] successfully put ${uniquePutList.length} items to table ${tableName}`);
            return result.$metadata.httpStatusCode === 200 ? true : false;
        }).catch(err => {
            errorResponse = err;
            return false;
        }).finally(() => {
            this.dynamoDBLibrary.statisticHandler(tableName, 'batchPut', uniquePutList, errorResponse);
        });
    }

    /**
     * Batch delete the items from the DynamoDB table
     * @param tableName the DynamoDB table name
     * @param currentDeleteList the list of items to be deleted from the DynamoDB table
     * @returns Promise<boolean> whether the delete operation is successful
     */
    @statistic()
    private static async batchDeleteQueueByTable(tableName: string, currentDeleteList: BATCH_COMMAND[string]) {

        let tableKey = await this.getTableKey(tableName);
        let uniqueDeleteList: BATCH_COMMAND[string] = [];

        currentDeleteList = currentDeleteList.reverse();
        currentDeleteList.forEach((item) => {
            let isUnique: boolean[] = [];
            tableKey.forEach((keyName) => {
                if (uniqueDeleteList.find((uniqueItem) => uniqueItem.DeleteRequest.Key[keyName] === item.DeleteRequest.Key[keyName])) isUnique.push(false);
            });
            if (isUnique.length != tableKey.length) uniqueDeleteList.push(item);
        });

        if (uniqueDeleteList.length === 0) return false;
        // error response record
        let errorResponse: any | undefined = undefined;
        // batch delete the items from the table, and return the result
        return this.dynamoDBLibrary.documentClient.batchWrite({
            RequestItems: { [tableName]: uniqueDeleteList },
        }).then((result) => {
            console.info(`[dynamodblibrary][batchDeleteQueueByTable] successfully delete ${uniqueDeleteList.length} data from table ${tableName}`);
            return result.$metadata.httpStatusCode === 200 ? true : false;
        }).catch(err => {
            errorResponse = err;
            return false;
        }).then(() => {
            this.dynamoDBLibrary.statisticHandler(tableName, 'batchDelete', uniqueDeleteList, errorResponse);
        });

    }

}
