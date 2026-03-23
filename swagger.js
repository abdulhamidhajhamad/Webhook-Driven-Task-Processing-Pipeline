"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_autogen_1 = __importDefault(require("swagger-autogen"));
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
(0, swagger_autogen_1.default)()(outputFile, endpointsFiles, doc).then(() => {
    console.log('Swagger documentation has been generated successfully.');
});
