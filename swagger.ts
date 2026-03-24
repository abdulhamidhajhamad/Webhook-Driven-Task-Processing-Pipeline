import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: {
    title: 'Webhook-Driven Task Processing Pipeline API',
    description: 'API for creating pipelines, accepting webhooks, and processing background jobs.',
  },
  host: 'localhost:3001',
  schemes: ['http'],
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/api/app.ts'];

swaggerAutogen()(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger documentation has been generated successfully.');
});
