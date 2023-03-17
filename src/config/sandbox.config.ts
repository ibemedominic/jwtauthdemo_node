import * as dotenv from 'dotenv';

dotenv.config();

const devMode = process.env.NODE_ENV || 'development'; // options include development, production, staging
const SERVER_URL = "https://localhost:5001";
const TIMEOUT = 30000;

console.log('SERVER_URL = ' + SERVER_URL);

function initialize(config) 
{

}

let result =
{
  initialize: null,
  developmentMode: devMode,
  timeout : TIMEOUT,
  serverUrl: SERVER_URL
};
result.initialize = initialize.bind(result);

export default result;

