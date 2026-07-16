import { NotificationProviderInterface } from "./NotificationProviderInterface.js";

export class MockProvider extends NotificationProviderInterface {
  async send(payload) {
    console.log(`[MockProvider] Sending message to ${payload.to}`);
    console.log(`[MockProvider] Message: ${payload.message}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate 5% failure rate
    if (Math.random() < 0.05) {
      return { success: false, error: "Mocked network failure" };
    }

    return { 
      success: true, 
      messageId: `mock_${Date.now()}_${Math.floor(Math.random() * 1000)}` 
    };
  }

  async status(messageId) {
    return {
      status: "delivered",
      timestamp: new Date()
    };
  }
}
