/* Existing browser audits exercise a returning visitor; the first-visit flow
   has its own isolated audit-onboarding.cjs. */
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const markTourSeen = () => { try { localStorage.setItem('medzo-tour-seen-v1', '1'); } catch (_) {} };
const chromium = {
  async launch(...args) {
    const browser = await playwright.chromium.launch(...args);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...options) => {
      const context = await newContext(...options);
      await context.addInitScript(markTourSeen);
      return context;
    };
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async (...options) => {
      const page = await newPage(...options);
      await page.addInitScript(markTourSeen);
      return page;
    };
    return browser;
  }
};
module.exports = {chromium};
