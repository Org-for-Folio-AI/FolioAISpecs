import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface S3StackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  s3KmsKey: kms.IKey;
}

export class S3Stack extends cdk.Stack {
  public readonly callRecordingsBucket: s3.Bucket;
  public readonly emailAttachmentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    // Call Recordings Bucket: folio-call-recordings-{account-id}
    // Stores audio files from Twilio calls
    // Lifecycle: Standard → Standard-IA (90 days) → Glacier (1 year) → Delete (7 years)
    this.callRecordingsBucket = new s3.Bucket(this, 'CallRecordingsBucket', {
      bucketName: `${props.appName}-call-recordings-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.s3KmsKey,
      versioning: s3.VersioningStatus.DISABLED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycle: [
        {
          id: 'archive-to-ia',
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER_IR,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          expiration: cdk.Duration.days(2555), // 7 years
        },
      ],
      enforceSSL: true,
      publicReadAccess: false,
    });

    // Email Attachments Bucket: folio-email-attachments-{account-id}
    // Stores PDF attachments from emails (folio docs, invoices, etc.)
    // Lifecycle: Standard → Standard-IA (30 days) → Delete (2 years)
    this.emailAttachmentsBucket = new s3.Bucket(this, 'EmailAttachmentsBucket', {
      bucketName: `${props.appName}-email-attachments-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.s3KmsKey,
      versioning: s3.VersioningStatus.DISABLED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycle: [
        {
          id: 'archive-to-ia',
          transitions: [
            {
              storageClass: s3.StorageClass.STANDARD_IA,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
          expiration: cdk.Duration.days(730), // 2 years
        },
      ],
      enforceSSL: true,
      publicReadAccess: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'CallRecordingsBucketName', {
      value: this.callRecordingsBucket.bucketName,
      description: 'S3 bucket for call recordings',
    });

    new cdk.CfnOutput(this, 'CallRecordingsBucketArn', {
      value: this.callRecordingsBucket.bucketArn,
      description: 'Call Recordings bucket ARN',
    });

    new cdk.CfnOutput(this, 'EmailAttachmentsBucketName', {
      value: this.emailAttachmentsBucket.bucketName,
      description: 'S3 bucket for email attachments',
    });

    new cdk.CfnOutput(this, 'EmailAttachmentsBucketArn', {
      value: this.emailAttachmentsBucket.bucketArn,
      description: 'Email Attachments bucket ARN',
    });
  }
}
