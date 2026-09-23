import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';

export async function uploadToAzure(
  file: Express.Multer.File,
  userId: number,
): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable is not set',
    );
  }

  const containerName = 'profile-images';

  // 1. Initialize Client
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // 2. Create container as PRIVATE (Remove the { access: 'blob' } option)
  await containerClient.createIfNotExists();

  // 3. Sanitize filename
  const sanitizedFileName = file.originalname
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '');

  const blobName = `${userId}-${crypto.randomUUID()}-${sanitizedFileName}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // 4. Upload buffer (Overwrite if exists)
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  // 5. Generate SAS Token (Required for viewing private files)
  // We need to extract the Account Name and Key from the connection string to sign the token
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1] || '';

  const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1] || '';

  if (!accountName || !accountKey) {
    throw new Error(
      'Invalid Connection String: Could not parse AccountName or AccountKey',
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read-only permission
      expiresOn: new Date(
        new Date().valueOf() + 100 * 365 * 24 * 60 * 60 * 1000,
      ), // Expires in 100 years
    },
    sharedKeyCredential,
  ).toString();

  // 6. Return the URL with the SAS token attached
  return `${blockBlobClient.url}?${sasToken}`;
}

export async function uploadToAzureCompanyLogo(
  file: Express.Multer.File,
  userId: number,
): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable is not set',
    );
  }

  const containerName = 'company-logo';

  // 1. Initialize Client
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // 2. Create container as PRIVATE (Remove the { access: 'blob' } option)
  await containerClient.createIfNotExists();

  // 3. Sanitize filename
  const sanitizedFileName = file.originalname
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '');

  const blobName = `${userId}-${crypto.randomUUID()}-${sanitizedFileName}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // 4. Upload buffer (Overwrite if exists)
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  // 5. Generate SAS Token (Required for viewing private files)
  // We need to extract the Account Name and Key from the connection string to sign the token
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1] || '';

  const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1] || '';

  if (!accountName || !accountKey) {
    throw new Error(
      'Invalid Connection String: Could not parse AccountName or AccountKey',
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read-only permission
      expiresOn: new Date(
        new Date().valueOf() + 100 * 365 * 24 * 60 * 60 * 1000,
      ), // Expires in 100 years
    },
    sharedKeyCredential,
  ).toString();

  // 6. Return the URL with the SAS token attached
  return `${blockBlobClient.url}?${sasToken}`;
}

export async function uploadAttachmentToAzure(
  file: Express.Multer.File,
  userId: number,
): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable is not set',
    );
  }

  const containerName = 'comment-attachments';

  // 1. Initialize Client
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);

  const containerClient = blobServiceClient.getContainerClient(containerName);

  // 2. Create container as PRIVATE
  await containerClient.createIfNotExists();

  // 3. Sanitize filename
  const sanitizedFileName = file.originalname
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '');

  const blobName = `${userId}-${crypto.randomUUID()}-${sanitizedFileName}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // 4. Upload buffer
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  // 5. Generate SAS Token
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1] || '';
  const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1] || '';

  if (!accountName || !accountKey) {
    throw new Error(
      'Invalid Connection String: Could not parse AccountName or AccountKey',
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read-only permission
      expiresOn: new Date(
        new Date().valueOf() + 100 * 365 * 24 * 60 * 60 * 1000,
      ), // Expires in 100 years
    },
    sharedKeyCredential,
  ).toString();

  // 6. Return the URL with the SAS token attached
  return `${blockBlobClient.url}?${sasToken}`;
}

export async function uploadTaskAttachmentToAzure(
  file: Express.Multer.File,
  userId: number,
): Promise<string> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable is not set',
    );
  }

  const containerName = 'task-attachments';

  // 1. Initialize Client
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);

  const containerClient = blobServiceClient.getContainerClient(containerName);

  // 2. Create container as PRIVATE
  await containerClient.createIfNotExists();

  // 3. Sanitize filename
  const sanitizedFileName = file.originalname
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.-]/g, '');

  const blobName = `${userId}-${crypto.randomUUID()}-${sanitizedFileName}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // 4. Upload buffer
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  // 5. Generate SAS Token
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1] || '';
  const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1] || '';

  if (!accountName || !accountKey) {
    throw new Error(
      'Invalid Connection String: Could not parse AccountName or AccountKey',
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(
    accountName,
    accountKey,
  );

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read-only permission
      expiresOn: new Date(
        new Date().valueOf() + 100 * 365 * 24 * 60 * 60 * 1000,
      ), // Expires in 100 years
    },
    sharedKeyCredential,
  ).toString();

  // 6. Return the URL with the SAS token attached
  return `${blockBlobClient.url}?${sasToken}`;
}
