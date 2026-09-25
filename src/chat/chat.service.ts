import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatService {
  async processChat(message: string): Promise<any> {
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL;
      // Forward the request to the Python LangGraph backend as a stream
      const response = await axios.post(`${aiServiceUrl}/chat`, { message }, {
        responseType: 'stream',
      });
      return response.data;
    } catch (error) {
      console.error('Error proxying to LangGraph service:', error);
      throw new HttpException(
        'Failed to process chat with AI service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
