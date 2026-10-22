const { PrismaClient } = require('@prisma/client');

const path = require('path');
const fs = require('fs');

const certRelativePath = 'certs/ca.pem';
const certFullPath = path.resolve(__dirname, '../../prisma', certRelativePath);

if (fs.existsSync(certFullPath)) {
  if (!process.env.SSL_CERT_FILE) {
    process.env.SSL_CERT_FILE = certFullPath;
  }
}

let databaseUrl = process.env.DATABASE_URL;

// If a CA certificate exists at prisma/certs/ca.pem and sslcert is not explicitly provided in DATABASE_URL,
// configure Prisma to strictly validate the server certificate using the trusted CA certificate.
if (databaseUrl && databaseUrl.includes('mysql://') && !databaseUrl.includes('sslcert=')) {
  if (fs.existsSync(certFullPath)) {
    const separator = databaseUrl.includes('?') ? '&' : '?';
    databaseUrl = `${databaseUrl}${separator}sslcert=${certRelativePath}&sslaccept=strict`;
  }
}

const prisma = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

module.exports = prisma;
