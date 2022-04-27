import { DynamoDBLibrary } from "../libraries/dynamodb.library";

export class Model {

    public created_at?: number;
    public updated_at?: number;

    constructor(data?: Model) {
        if (!data) return this;
        for (let key in data) this[key] = data[key];
        return this;
    }

    /**
     * Generate the actual DynamoDB table name for the given Model class name.
     * @param className The name of the Model class.
     * @returns string of the actual DynamoDB table name.
     */
    static getTableName(className: string | undefined = undefined): string {
        let environmentName = `DYNAMODB_TABLE_${(className ? className : this.name).replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
        let environmentNameComponent = environmentName.split('_'); environmentNameComponent.pop();
        let tableName = process.env[environmentNameComponent.join('_').toUpperCase()];
        if (!tableName) throw new Error(`[Model][getTableName] table name not found for ${environmentName}`);
        return tableName;
    }

    /**
     * Compare the given object with the current object, and update the current object with the given object.
     * @param newData The new data to update the current object with.
     * @returns string[] The list of keys that are updated.
     */
    public compareAndSave(newData: Model) {
        let updatedFields: string[] = []
        let newDataObject = JSON.parse(JSON.stringify(newData));
        for (let key in newDataObject) if (JSON.stringify(newDataObject[key]) !== JSON.stringify(this[key])) {
            this[key] = newDataObject[key];
            updatedFields.push(key);
        }
        return updatedFields;
    }

    /**
     * Save the current object to the DynamoDB table.
     * @returns Promise<boolean> Whether the save operation is successful.
     */
    public async save() {
        return Model.put(this, this.constructor.name);
    }

    /**
     * Delete the current object from the DynamoDB table.
     * @returns Promise<boolean> Whether the delete operation is successful.
     */
    public async delete() {
        return Model.delete(this, this.constructor.name);
    }

    /**
     * Static method to get the object by the given key.
     * @param key The key to get the object by.
     * @returns Promise<Model|null> The object if found, otherwise null.
     */
    public static async get(key: { [key: string]: string }): Promise<Model | null> {
        let tableName = this.getTableName();
        return DynamoDBLibrary.get(tableName, key);
    }

    /**
     * Static method to put the object to the DynamoDB table.
     * @param data The object to put to the DynamoDB table.
     * @param className The name of the Model class.
     * @returns Promise<boolean> Whether the put operation is successful.
     */
    public static async put(data: Model, className: string | undefined = undefined): Promise<boolean> {
        let tableName = this.getTableName(className);
        if (!data.created_at) data.created_at = Date.now();
        data.updated_at = Date.now();
        return DynamoDBLibrary.put(tableName, data);
    }

    /**
     * Static method to scan the DynamoDB table by the given filter and return the list of objects.
     * @param query The filter to scan the DynamoDB table by.
     * @returns Promise<Model[]> The list of objects.
     */
    public static async scan(query: { [key: string]: string } | undefined = undefined): Promise<Model[]> {
        let tableName = this.getTableName();
        return DynamoDBLibrary.scan(tableName, query);
    }

    /**
     * Static method to delete the object by the given key.
     * @param data The key to delete the object by.
     * @param className The name of the Model class.
     * @returns Promise<boolean> Whether the delete operation is successful.
     */
    public static async delete(data: Model | { [key: string]: string }, className: string | undefined = undefined): Promise<boolean> {
        let tableName = this.getTableName(className);
        return DynamoDBLibrary.delete(tableName, data);
    }

}
