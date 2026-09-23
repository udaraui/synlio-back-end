import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ChatService {
  async processChat(message: string): Promise<any> {
    try {
      // Forward the request to the Python LangGraph backend
      const response = await axios.post('http://localhost:8000/chat', { message });
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
