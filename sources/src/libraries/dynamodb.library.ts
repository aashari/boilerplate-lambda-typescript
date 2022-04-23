import { DynamoDBClient, WriteRequest } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { Model } from '../models/model';

interface BATCH_COMMAND {
    [key: string]: (Omit<WriteRequest, "PutRequest" | "DeleteRequest"> & {
        PutRequest?: any | undefined;
        DeleteRequest?: any | undefined;
    })[];
}

export class DynamoDBLibrary {

    private client: DynamoDBDocument;
    private static dynamoDBLibrary: DynamoDBLibrary;

    private putCommandList: BATCH_COMMAND = {};
    private putCommandWaitingHandle: NodeJS.Timeout | undefined;

    constructor() { }

    public async initiateDatadogConfiguration() {
        this.client = DynamoDBDocument.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? 'ap-southeast-1' }));
    }

    public static async instance(): Promise<DynamoDBLibrary> {
        if (!DynamoDBLibrary.dynamoDBLibrary) DynamoDBLibrary.dynamoDBLibrary = new DynamoDBLibrary();
        await DynamoDBLibrary.dynamoDBLibrary.initiateDatadogConfiguration();
        return DynamoDBLibrary.dynamoDBLibrary;
    }

    public static async get(tableName: string, key: { [key: string]: string }): Promise<Model | null> {

        // check whether the data still in queue
        if (this.dynamoDBLibrary.putCommandList[tableName]) {
            let currentPutList: BATCH_COMMAND[string] = JSON.parse(JSON.stringify(this.dynamoDBLibrary.putCommandList[tableName]));
            for (let keyName in key) {
                currentPutList = currentPutList.filter((item) => item.PutRequest.Item[keyName] === key[keyName]);
            }
            if (currentPutList.length > 0) return currentPutList[0].PutRequest.Item;
        }

        return this.dynamoDBLibrary.client.get({
            TableName: tableName, Key: key,
        }).then((result) => {
            return result.Item ? result.Item as any : null;
        }).catch(err => {
            console.error(`[dynamodblibrary][get] Error: ${err}`);
            return null;
        });
    }

    public static async put(tableName: string, data: Model) {

        // generate queue for put command
        if (!this.dynamoDBLibrary.putCommandList[tableName]) this.dynamoDBLibrary.putCommandList[tableName] = [];
        this.dynamoDBLibrary.putCommandList[tableName].push({ PutRequest: { Item: data } });

        // if there's existing waiting to publish, cancel it
        if (this.dynamoDBLibrary.putCommandWaitingHandle) {
            clearTimeout(this.dynamoDBLibrary.putCommandWaitingHandle);
        }

        // if there's no metrics queued for 1 second, publish them
        this.dynamoDBLibrary.putCommandWaitingHandle = setTimeout(() => {
            if (!tableName) return;
            let currentPutList: BATCH_COMMAND[string] = JSON.parse(JSON.stringify(this.dynamoDBLibrary.putCommandList[tableName]));
            this.dynamoDBLibrary.putCommandList[tableName] = [];
            this.batchPutMonitor(tableName, currentPutList);
        }, 1000);

        // successfully queued write command
        return true;

    }

    private static async batchPutMonitor(tableName: string, currentPutList: BATCH_COMMAND[string]) {

        let tempCurrentPutList = JSON.parse(JSON.stringify(currentPutList));
        currentPutList = tempCurrentPutList.reduce((acc, cur) => {
            if (!acc.find((item: any) => item.PutRequest.Item.id === cur.PutRequest.Item.id)) acc.push(cur);
            return acc;
        }, []);

        console.info(`[dynamodblibrary][batchPutMonitor] Publishing ${currentPutList.length} ${tableName}`);
        return this.dynamoDBLibrary.client.batchWrite({
            RequestItems: { [tableName]: currentPutList },
        }).then((result) => {
            return result.$metadata.httpStatusCode === 200 ? true : false;
        }).catch(err => {
            console.error(`[dynamodblibrary][batchputmonitor] Error: ${err}`);
            return false;
        });
    }

}
