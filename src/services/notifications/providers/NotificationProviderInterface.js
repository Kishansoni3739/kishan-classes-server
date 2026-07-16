/**
 * Abstract class defining the Notification Provider Interface.
 */
export class NotificationProviderInterface {
  constructor(config) {
    this.config = config;
  }

  /**
   * Send a message immediately.
   * @param {Object} payload - { to: string, message: string, templateId?: string, variables?: object }
   * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
   */
  async send(payload) {
    throw new Error("send() method must be implemented by the provider");
  }

  /**
   * Check the delivery status of a sent message.
   * @param {string} messageId
   * @returns {Promise<Object>} { status: 'delivered'|'read'|'failed', timestamp: Date }
   */
  async status(messageId) {
    throw new Error("status() method must be implemented by the provider");
  }
}
