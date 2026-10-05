import { S3Client, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
dotenv.config();

async function makeBucketPublic() {
  const bucket = process.env.DO_SPACES_BUCKET || 'tucancha';
  const endpoint = process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com';
  const region = process.env.DO_SPACES_REGION || 'nyc3';
  const accessKeyId = process.env.DO_SPACES_KEY || '';
  const secretAccessKey = process.env.DO_SPACES_SECRET || '';

  if (!accessKeyId || !secretAccessKey) {
    console.error('Missing DO_SPACES_KEY or DO_SPACES_SECRET');
    return;
  }

  const s3Client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadGetObject",
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  };

  try {
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify(policy),
      })
    );
    console.log(`✅ Bucket ${bucket} is now completely PUBLIC!`);
  } catch (error) {
    console.error(`❌ Error setting bucket policy:`, error);
  }
}

makeBucketPublic();
