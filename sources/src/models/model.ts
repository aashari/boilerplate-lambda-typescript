import { DynamoDBLibrary } from "../libraries/dynamodb.library";

export class Model {

    public id: string;
    public created_at?: number;
    public updated_at?: number;

    static getTableName(className: string | undefined = undefined): string {
        let environmentName = `DYNAMODB_TABLE_${(className ? className : this.name).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
        let environmentNameComponent = environmentName.split('_'); environmentNameComponent.pop();
        let tableName = process.env[environmentNameComponent.join('_').toUpperCase()];
        if (!tableName) throw new Error(`[dynamodblibrary][get] Table name not found for ${className ? className : this.name}`);
        return tableName;
    }

    public async save() {
        return Model.put(this, this.constructor.name);
    }

    public static async get(key: { [key: string]: string }): Promise<Model | null> {
        let tableName = this.getTableName();
        return DynamoDBLibrary.get(tableName, key);
    }

    public static async put(data: Model, className: string | undefined = undefined): Promise<boolean> {
        let tableName = this.getTableName(className);
        if (!data.created_at) data.created_at = Date.now();
        data.updated_at = Date.now();
        return DynamoDBLibrary.put(tableName, data);
    }

}
