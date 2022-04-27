import { GetParametersByPathCommand, Parameter, SSMClient } from "@aws-sdk/client-ssm";

const SSM_PREFIX = `${process.env.PARAMETER_STORE_PATH}/`;
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });

/**
 * Parse the parameter store by path and define the environment variables
 * @returns Promise<{ [key: string]: string }> The environment variables map
 */
export async function populateEnvironmentVariables() {

    let parameterList: Parameter[] = [];

    // get all parameter based on the prefix
    let nexToken: string | undefined;
    while (true) {
        let parameterListResponse = await ssmClient.send(new GetParametersByPathCommand({
            Path: SSM_PREFIX,
            WithDecryption: true,
            NextToken: nexToken
        })).catch(e => {
            console.error(`[ParameterStoreHelper][populateEnvironmentVariables] failed to get parameters from parameter store`, e);
            return null;
        });
        if (parameterListResponse?.Parameters) {
            parameterList = parameterList.concat(parameterListResponse.Parameters);
        }
        if (!parameterListResponse?.NextToken) break;
        nexToken = parameterListResponse.NextToken;
    }

    // parse the parameters and set the environment variables
    for (let parameter of parameterList) {
        if (!parameter?.Name) continue;
        // parse the name of the parameter
        // this will convert the parameter name to upper case and replace the '-' with '_'
        let key = parameter.Name.replace(SSM_PREFIX, '').toUpperCase().replace(/[^a-zA-Z0-9]/g, '_');
        if (key.startsWith(`_`)) key = key.substring(1);
        // get the value of the parameter
        let value = parameter.Value;
        if (!value) continue;
        // set the environment variable
        console.info(`[ParameterStoreHelper][populateEnvironmentVariables] setting environment variable ${key}`);
        process.env[key] = value;
    }

    return process.env

}