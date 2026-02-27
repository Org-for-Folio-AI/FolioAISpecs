import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface SecurityStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
}

export class SecurityStack extends cdk.Stack {
  public readonly secretsKmsKey: kms.Key;
  public readonly dynamodbKmsKey: kms.Key;
  public readonly s3KmsKey: kms.Key;
  public readonly twilioSecret: secrets.Secret;
  public readonly elevenLabsSecret: secrets.Secret;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // KMS Key for Secrets Manager
    this.secretsKmsKey = new kms.Key(this, 'SecretsKmsKey', {
      description: 'KMS key for encrypting Folio secrets',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.secretsKmsKey.addAlias(`${props.appName}-secrets-key`);

    // KMS Key for DynamoDB
    this.dynamodbKmsKey = new kms.Key(this, 'DynamoDBKmsKey', {
      description: 'KMS key for encrypting DynamoDB tables',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.dynamodbKmsKey.addAlias(`${props.appName}-dynamodb-key`);

    // KMS Key for S3
    this.s3KmsKey = new kms.Key(this, 'S3KmsKey', {
      description: 'KMS key for encrypting S3 buckets',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.s3KmsKey.addAlias(`${props.appName}-s3-key`);

    // Twilio Credentials Secret
    // Stores: account_sid, auth_token, phone_number
    this.twilioSecret = new secrets.Secret(this, 'TwilioSecret', {
      secretName: `${props.appName}/twilio`,
      description: 'Twilio account credentials',
      encryptionKey: this.secretsKmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          account_sid: 'AC_PLACEHOLDER',
          auth_token: 'TOKEN_PLACEHOLDER',
          phone_number: '+1XXXYYYZZZZ',
        }),
        generateStringKey: 'temp_password',
        excludeCharacters: '"\'\\',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Eleven Labs API Key Secret
    this.elevenLabsSecret = new secrets.Secret(this, 'ElevenLabsSecret', {
      secretName: `${props.appName}/elevenlabs`,
      description: 'Eleven Labs API credentials',
      encryptionKey: this.secretsKmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          api_key: 'API_KEY_PLACEHOLDER',
          voice_id: 'VOICE_ID_PLACEHOLDER',
        }),
        generateStringKey: 'temp_password',
        excludeCharacters: '"\'\\',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Email Credentials Secret (SMTP/IMAP or SES)
    const emailSecret = new secrets.Secret(this, 'EmailSecret', {
      secretName: `${props.appName}/email`,
      description: 'Email system credentials',
      encryptionKey: this.secretsKmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_user: 'user@example.com',
          smtp_password: 'PASSWORD_PLACEHOLDER',
          imap_host: 'imap.example.com',
          imap_port: 993,
          imap_user: 'user@example.com',
          imap_password: 'PASSWORD_PLACEHOLDER',
        }),
        generateStringKey: 'temp_password',
        excludeCharacters: '"\'\\',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Textract Configuration Secret
    const textractSecret = new secrets.Secret(this, 'TextractSecret', {
      secretName: `${props.appName}/textract`,
      description: 'AWS Textract configuration',
      encryptionKey: this.secretsKmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          s3_output_bucket: `${props.appName}-textract-output-${accountId}`,
          sns_topic_arn: '',
          role_arn: '',
        }),
        generateStringKey: 'temp_password',
        excludeCharacters: '"\'\\',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'SecretsKmsKeyId', {
      value: this.secretsKmsKey.keyId,
      description: 'KMS key ID for Secrets Manager',
    });

    new cdk.CfnOutput(this, 'DynamoDBKmsKeyId', {
      value: this.dynamodbKmsKey.keyId,
      description: 'KMS key ID for DynamoDB',
    });

    new cdk.CfnOutput(this, 'S3KmsKeyId', {
      value: this.s3KmsKey.keyId,
      description: 'KMS key ID for S3',
    });

    new cdk.CfnOutput(this, 'TwilioSecretArn', {
      value: this.twilioSecret.secretArn,
      description: 'Twilio credentials secret ARN',
    });

    new cdk.CfnOutput(this, 'ElevenLabsSecretArn', {
      value: this.elevenLabsSecret.secretArn,
      description: 'Eleven Labs API key secret ARN',
    });
  }
}
