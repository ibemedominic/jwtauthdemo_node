import { getLogger } from './system/logging';
import config from './config/sandbox.config';

import yargs = require('yargs/yargs');
import axios from "axios";
import { AxiosInstance, Axios } from "axios";
import { BankDetails } from 'system/requestdata';
import { Agent } from "https";
import * as jose from "jose";
import * as fs from 'fs';
import * as crypto from "crypto";

let logger = getLogger();

class Actor
{

  private accessToken : string;
  private _refreshToken : string;
  private userName : string;
  private headers : {};
  private axiosInstance : AxiosInstance;
  private privateKey : string;
  private publicKey : string;
  private bankKey : string;
  private bankAlgorithm : string;

  constructor(key : string)
  {
    this.privateKey = key;

    this.axiosInstance = axios.create({
      baseURL: `${config.serverUrl}/api`,
      timeout: config.timeout,
      httpsAgent: new Agent({  
        rejectUnauthorized: false
      }),
      headers: {}
    });
  }

  private async initialize() : Promise<void>
  {
    let me = this;
    let parts : string[] = me.accessToken.split(".");
    if(parts.length == 5)
    {
      let jwe = { protected : parts[0], encrypted_key: parts[1], iv : parts[2], ciphertext : parts[3], tag : parts[4] };
      const rsaPrivateKey = await jose.importPKCS8(this.privateKey, "RS256");
      
      console.log("\n\n /*******************************************************************************************************");
      console.log("\n\n Initializing with JWE Access Token - components ");
      console.log("\n\n Protected Header : " + jwe.protected);
      console.log("\n\n Encrypted Key : " + jwe.encrypted_key);
      console.log("\n\n Initialization Vector : " + jwe.iv);
      console.log("\n\n Cipher Text : " + jwe.ciphertext);
      console.log("\n\n Authentication Tag : " + jwe.tag);
      console.log("\n\n *******************************************************************************************************/");

      const { plaintext, protectedHeader } = await jose.flattenedDecrypt(jwe, rsaPrivateKey);

      const decoder = new TextDecoder()
      let content = decoder.decode(plaintext);
      
      console.log("\n\n Decrypted Protected Header = ");
      console.log(protectedHeader);

      console.log("\n\n Decrypted Content in Base64URL = \n\n" + content);

      let token : any = jose.decodeJwt(content);
      console.log("\n\n Actual JWT Payload = " + JSON.stringify(token));
      this.bankKey = token["symkey"];
      this.bankAlgorithm = token["symalgo"];
    }

    me.headers = {
      "Authorization" : "Bearer " + me.accessToken,
      "X-Custom-Header" : "foobar",
      "Accept" : "*/*"
    };

    me.axiosInstance = axios.create({
      baseURL: `${config.serverUrl}/api`,
      timeout: config.timeout,
      httpsAgent: new Agent({  
        rejectUnauthorized: false,
        keepAlive : true
      }),
      withCredentials : true,
      headers: { ...me.headers }
    });
  }

  async login() : Promise<void>
  {
    let me = this;
    let loginData = {
      username : "test1",
      password : "password1"
    };

    logger.info(`\n\n Logging In to Server at Endpoint ${config.serverUrl}/api/account/login `);
    let result = new Promise<void>((resolve, reject)=>
    {
      me.axiosInstance.post("account/login", loginData)
      .then((result)=>
      {
        logger.info(" Login Response = ");
        logger.info(result.data);

        me.accessToken = result.data.accessToken;
        me._refreshToken = result.data.refreshToken;
        me.userName = result.data.username;
        logger.info(`Connected to Server - User Name = ${me.userName}  Refresh Token = ${me._refreshToken}`);
      })
      .then((value)=>
      {
        me.initialize().then((none)=>
        {
          resolve();
        })
      })
      .catch((error)=>
      {
        logger.error("Error Occurred In Login");
        logger.error(error);
        reject(error);
      });
    });

    return result;
  }
  
  async refreshToken() : Promise<void>
  {
    let me = this;
    let loginData = {
      username :me.userName,
      refreshToken : me._refreshToken
    };

    logger.info(`\n\n Refreshing Token from Server at Endpoint ${config.serverUrl}/api/account/refresh-token `);
    let result = me.axiosInstance.post("account/refresh-token", loginData)
    .then((result)=>
    {

      me.accessToken = result.data.accessToken;
      me._refreshToken = result.data.refreshToken;
      me.userName = result.data.username;
      logger.info(" \n\n New Refreshed Token = " + result.data.refreshToken);
      logger.info(" \n\n New Access Token = " + result.data.accessToken);
    })
    .then(()=>
    {
      return me.initialize();
    })
    .catch((error)=>
    {
      logger.error("Error Occurred in Refresh token");
      logger.error(error);
      throw error;
    });
    return result;
  }

  async sendBankRecord() : Promise<any>
  {
    let bankRecord : BankDetails = {
      accountNumber : "1230099322",
      accountName : "Ivan Smith",
      cardNumber : "1123343234330",
      balance : 20000,
      cardType : "VISA",
      cvv : "332"
    };

    console.log(`\n\n Connecting to Bank Server on Endpoint = ${config.serverUrl}/api/bank/submit`);
    console.log(`\n\n Bank Algorithm = ${this.bankAlgorithm} \n\n The Bank Key = ${this.bankKey}`);

    // generate 16 bytes of random data
    const initVector = crypto.randomBytes(16);
    let message = JSON.stringify(bankRecord);
    const bkey = Buffer.from(this.bankKey, "base64");

    // the cipher function
    const cipher = crypto.createCipheriv(this.bankAlgorithm, bkey, initVector);

    // encrypt the message
    // input encoding
    // output encoding
    message = cipher.update(message, "utf-8", "base64");
    message += cipher.final("base64");

    let encrypted = { cipherText : message, iv : initVector.toString("base64") };
    console.log(` \n\n Original Bank Record =  ${JSON.stringify(bankRecord)} `);
    console.log(" Sending Encrypted Bank Record = " + message);

    let result = this.axiosInstance.post("bank/submit", encrypted)
    .then((result)=>
    {
      logger.info(" Submit Request = ");
      logger.info(result.data);
    }).catch((error)=>
    {
      logger.error("Error Occurred Sending Bank Details");
      logger.error(error);
    });
    return result;
  }

  
  async getBankRecord(accountNumber : string) : Promise<any>
  {
    console.log(` \n\n Requesting Bank Record =  ${config.serverUrl}/api/bank/request/${accountNumber} `);
    let result = this.axiosInstance.get(`bank/request/${accountNumber}`)
    .then((result)=>
    {
      logger.info(" Returned Account Record = ");
      logger.info(result.data);
      let message = result.data.cipherText;
      let iv = result.data.iv;

      const initVector = Buffer.from(iv, "base64");
      const key = Buffer.from(this.bankKey, "base64");

      // the Decipher function
      const decipher = crypto.createDecipheriv(this.bankAlgorithm, key, initVector);
      console.log("Created Decipher Algorithm");

      // encrypt the message
      // input encoding
      // output encoding
      let decryptedMessage = decipher.update(message, "base64", "base64");
      decryptedMessage += decipher.final("base64");

      let buffer : Buffer = Buffer.from(decryptedMessage, "base64");
      let rawMessage = buffer.toString("utf-8");
      let bankDetails = JSON.parse(rawMessage);
      console.log("Retrieved Bank Record = " + JSON.stringify(bankDetails));
    }).catch((error)=>
    {
      logger.error("Error Occurred retrieving Bank Record");
      logger.error(error);
    });
    return result;
  }

}



const argv = yargs(process.argv.slice(2)).options({
  r : { type: 'boolean', alias : "run", default : true, defaultDescription : "This can be used to Run through the entire Demo at one" },
  d : { type: 'boolean', alias : "describe", default : false, defaultDescription : "This describes what the program is supposed to do." }
}).argv;

const run: Function = async () => 
{
    const logger = getLogger();
    const describe : string = argv["d"] || "";

    logger.info("Starting Execution");
    let file = "E:/workspace/csharp/projects/JwtAuthDemo/webapi/JwtAuthDemo/private_key.pem";
    let algorithm = "RS256";
    let privateKey = fs.readFileSync(file, { encoding : "ascii"});

    
    let actor : Actor = new Actor(privateKey);
    logger.info("\n\n Performing Login");
    await actor.login();
    logger.info("\n\n Performing Token Refresh ");
    await actor.refreshToken();
    logger.info("\n\n Sending Bank Record ");
    await actor.sendBankRecord();
    logger.info("\n\n Retrieving Bank Record ");
    await actor.getBankRecord("22112233");
    
}

run()
