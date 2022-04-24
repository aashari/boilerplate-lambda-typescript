import { DescribeTableCommand, DynamoDBClient, ScanCommandInput, WriteRequest } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { statistic } from '../decorators/statistic.decorator';
import { Model } from '../models/model';

interface BATCH_COMMAND {
    [key: string]: (Omit<WriteRequest, "PutRequest" | "DeleteRequest"> & {
        PutRequest?: any | undefined;
        DeleteRequest?: any | undefined;
    })[];
}

export class DynamoDBLibrary {

    private dynamoDBClient: DynamoDBClient;
    private documentClinet: DynamoDBDocument;
    private dynamodbTableKey: { [tableName: string]: string[] } = {};

    private static dynamoDBLibrary: DynamoDBLibrary;

    private putCommandList: BATCH_COMMAND = {};
    private putCommandWaitingHandle: NodeJS.Timeout | undefined;

    private deleteCommandList: BATCH_COMMAND = {};
    private deleteCommandWaitingHandle: NodeJS.Timeout | undefined;

    constructor() { }

    public async initiateDatadogConfiguration() {
        this.dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'ap-southeast-1' });
        this.documentClinet = DynamoDBDocument.from(this.dynamoDBClient);
    }

    public static async instance(): Promise<DynamoDBLibrary> {
        if (!DynamoDBLibrary.dynamoDBLibrary) DynamoDBLibrary.dynamoDBLibrary = new DynamoDBLibrary();
        await DynamoDBLibrary.dynamoDBLibrary.initiateDatadogConfiguration();
        return DynamoDBLibrary.dynamoDBLibrary;
    }

    @statistic()
    private static async getTableKey(tableName: string) {
        if (this.dynamoDBLibrary.dynamodbTableKey[tableName]) return this.dynamoDBLibrary.dynamodbTableKey[tableName];
        let tableKey: string[] = [];
        let tableDescription = await this.dynamoDBLibrary.dynamoDBClient.send(new DescribeTableCommand({ TableName: tableName }));
        tableDescription.Table?.KeySchema?.forEach((key) => {
            if (key.AttributeName) tableKey.push(key.AttributeName);
        });
        this.dynamoDBLibrary.dynamodbTableKey[tableName] = tableKey;
        return tableKey;
    }

    @statistic()
    public static async get(tableName: string, key: { [key: string]: string }): Promise<Model | null> {

        // check whether the data still in queue
        if (this.dynamoDBLibrary.putCommandList[tableName]) {
            let currentPutList: BATCH_COMMAND[string] = this.dynamoDBLibrary.putCommandList[tableName];
            for (let keyName in key) {
                currentPutList = currentPutList.filter((item) => item.PutRequest.Item[keyName] === key[keyName]);
            }
            if (currentPutList.length > 0) return currentPutList[0].PutRequest.Item;
        }

        return this.dynamoDBLibrary.documentClinet.get({
            TableName: tableName, Key: key,
        }).then((result) => {
            return result.Item ? result.Item as any : null;
        }).catch(err => {
            console.error(`[DynamoDBLibrary][get] failed to get data from table ${tableName} with key ${JSON.stringify(key)}`);
            return null;
        });
    }

    public static async put(tableName: string, data: Model, isQueue: boolean = true): Promise<boolean> {

        if (!isQueue) {
            return this.dynamoDBLibrary.documentClinet.put({
                TableName: tableName, Item: data,
            }).then((result) => {
                return result.$metadata.httpStatusCode === 200 ? true : false;
            }).catch(err => {
                console.error(`[dynamodblibrary][put] failed to put data to table ${tableName} with data ${JSON.stringify(data)}`);
                return false;
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
            this.batchPutQueueByTable(tableName, currentPutList);
        }, 300);

        // successfully queued write command
        return true;

    }

    public static async delete(tableName: string, data: Model | { [key: string]: string }, isQueue: boolean = true): Promise<boolean> {

        let tableKey = await this.getTableKey(tableName);
        let key = {};

        tableKey.forEach((keyName) => {
            key[keyName] = data[keyName];
        });

        if (!isQueue) {
            return this.dynamoDBLibrary.documentClinet.delete({
                TableName: tableName, Key: key,
            }).then((result) => {
                return result.$metadata.httpStatusCode === 200 ? true : false;
            }).catch(err => {
                console.error(`[dynamodblibrary][delete] failed to delete data from table ${tableName} with data ${JSON.stringify(data)}`);
                return false;
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
            this.batchDeleteQueueByTable(tableName, currentDeleteList);
        }, 300);

        // successfully queued write command
        return true;

    }

    @statistic()
    public static async scan(tableName: string, filter: { [key: string]: string } | undefined = undefined, operand: string = 'AND'): Promise<Model[]> {
        let resultData: Model[] = [];
        let lastEvaluatedKey: { [key: string]: string } | undefined;
        while (true) {
            let params: ScanCommandInput = {
                TableName: tableName
            }
            if (filter) {
                params.FilterExpression = Object.keys(filter).map((key) => `#${key} = :${key}`).join(` ${operand} `);
                params.ExpressionAttributeValues = Object.keys(filter).reduce((acc, cur) => {
                    acc[`#${cur}`] = cur;
                    return acc;
                }, {})
            }
            let isSuccess = await this.dynamoDBLibrary.documentClinet.scan(params).then((result) => {
                lastEvaluatedKey = result.LastEvaluatedKey;
                resultData = resultData.concat(result.Items as Model[]);
                return result.$metadata.httpStatusCode === 200 ? true : false;
            }).catch(err => {
                console.error(`[dynamodblibrary][scan] failed to scan data from table ${tableName} with filter ${JSON.stringify(filter)}`);
                return false;
            });
            if (!isSuccess) break;
            if (!lastEvaluatedKey) break;
        }
        return resultData;
    }

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
            if (isUnique.length === 0) uniquePutList.push(item);
        });

        if (uniquePutList.length === 0) return false;

        return this.dynamoDBLibrary.documentClinet.batchWrite({
            RequestItems: { [tableName]: uniquePutList },
        }).then((result) => {
            console.info(`[dynamodblibrary][batchPutQueueByTable] successfully put ${uniquePutList.length} items to table ${tableName}`);
            return result.$metadata.httpStatusCode === 200 ? true : false;
        }).catch(err => {
            console.error(`[dynamodblibrary][batchPutQueueByTable] failed to batch put data to table ${tableName} with data ${JSON.stringify(currentPutList)}`);
            return false;
        });
    }

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
            if (isUnique.length === 0) uniqueDeleteList.push(item);
        });

        if (uniqueDeleteList.length === 0) return false;

        return this.dynamoDBLibrary.documentClinet.batchWrite({
            RequestItems: { [tableName]: uniqueDeleteList },
        }).then((result) => {
            console.info(`[dynamodblibrary][batchDeleteQueueByTable] successfully delete ${uniqueDeleteList.length} data from table ${tableName}`);
            return result.$metadata.httpStatusCode === 200 ? true : false;
        }).catch(err => {
            console.error(`[dynamodblibrary][batchDeleteQueueByTable] failed to batch delete data from table ${tableName} with data ${JSON.stringify(currentDeleteList)}`);
            return false;
        });

    }

}
