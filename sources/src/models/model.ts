import { DynamoDBLibrary } from "../libraries/dynamodb.library";

export class Model {

    public created_at?: number;
    public updated_at?: number;

    constructor(data?: Model) {
        if (!data) return this;
        for (let key in data) this[key] = data[key];
        return this;
    }


    static getTableName(className: string | undefined = undefined): string {
        let environmentName = `DYNAMODB_TABLE_${(className ? className : this.name).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
        let environmentNameComponent = environmentName.split('_'); environmentNameComponent.pop();
        let tableName = process.env[environmentNameComponent.join('_').toUpperCase()];
        if (!tableName) throw new Error(`[Model][getTableName] table name not found for ${environmentName}`);
        return tableName;
    }

    public compareAndSave(newData: Model) {
        let updatedFields: string[] = []
        let newDataObject = JSON.parse(JSON.stringify(newData));
        for (let key in newDataObject) if (JSON.stringify(newDataObject[key]) !== JSON.stringify(this[key])) {
            this[key] = newDataObject[key];
            updatedFields.push(key);
        }
        return updatedFields;
    }

    public async save() {
        return Model.put(this, this.constructor.name);
    }

    public async delete() {
        return Model.delete(this, this.constructor.name);
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

    public static async scan(query: { [key: string]: string } | undefined = undefined): Promise<Model[]> {
        let tableName = this.getTableName();
        return DynamoDBLibrary.scan(tableName, query);
    }

    public static async delete(data: Model | { [key: string]: string }, className: string | undefined = undefined): Promise<boolean> {
        let tableName = this.getTableName(className);
        return DynamoDBLibrary.delete(tableName, data);
    }

}
