import swaggerJSDoc from 'swagger-jsdoc';
import config from './index.js';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'The Den Fitness Gym API',
      version: '1.0.0',
      description: 'Production-ready, highly secure backend API documentation for The Den Fitness Gym.',
      contact: {
        name: 'The Den Gym Backend Architects',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}${config.apiPrefix}`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Path to the API routes files with JSDoc annotations
  apis: ['./src/modules/**/*.ts', './src/modules/**/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
