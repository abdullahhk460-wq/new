// Deprecated — brute force now handled directly in auth service via AdminUser lockout fields
export const bruteForceProtection = {
  async isAccountLocked(_email: string) { return false; },
  async handleFailedLogin(_email: string) {},
  async handleSuccessfulLogin(_email: string) {},
};
export default bruteForceProtection;
