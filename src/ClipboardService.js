import clipboardy from 'clipboardy';

/**
 * ClipboardService handles copying entries back to system clipboard
 */
class ClipboardService {
  /**
   * Copy content to system clipboard
   * @param {string} content - Content to copy
   * @returns {Promise<void>}
   */
  async copy(content) {
    try {
      await clipboardy.write(content);
    } catch (error) {
      throw new Error(`Failed to copy to clipboard: ${error.message}`);
    }
  }

  /**
   * Read current clipboard content
   * @returns {Promise<string>}
   */
  async read() {
    try {
      return await clipboardy.read();
    } catch (error) {
      throw new Error(`Failed to read from clipboard: ${error.message}`);
    }
  }
}

export default ClipboardService;
