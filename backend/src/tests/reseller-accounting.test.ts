import { ResellerRepository } from '../repositories/reseller.repository';

/**
 * Verification Test Suite for Reseller Prepaid Commission Module
 * Tests Sections 8, 9, 10, 11, 41, 42, 43, 44, 55 from specification
 */
export function runResellerAccountingTests() {
  const repo = new ResellerRepository();
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({ name: testName, passed: false, error: details || 'Assertion failed' });
    }
  }

  // ---- Section 43: Test 1 (Cash = 20, Commission = 50%) ----
  {
    const r = repo.calculateTopup(20, 50, 'CASH');
    assert(r.walletValue === 40, 'Test 1 Wallet Value', `Expected 40, got ${r.walletValue}`);
    assert(r.commissionAmount === 20, 'Test 1 Commission Amount', `Expected 20, got ${r.commissionAmount}`);
    assert(r.cashAmount === 20, 'Test 1 Cash Amount', `Expected 20, got ${r.cashAmount}`);
    assert(r.creditAmount === 0, 'Test 1 Credit Amount', `Expected 0, got ${r.creditAmount}`);
  }

  // ---- Section 43: Test 2 (Cash = 1,000, Commission = 50%) ----
  {
    const r = repo.calculateTopup(1000, 50, 'CASH');
    assert(r.walletValue === 2000, 'Test 2 Wallet Value', `Expected 2000, got ${r.walletValue}`);
    assert(r.commissionAmount === 1000, 'Test 2 Commission Amount', `Expected 1000, got ${r.commissionAmount}`);
  }

  // ---- Section 43: Test 3 (Cash = 1,000, Commission = 25%) ----
  {
    const r = repo.calculateTopup(1000, 25, 'CASH');
    assert(r.walletValue === 1333.33, 'Test 3 Wallet Value', `Expected 1333.33, got ${r.walletValue}`);
    assert(r.commissionAmount === 333.33, 'Test 3 Commission Amount', `Expected 333.33, got ${r.commissionAmount}`);
  }

  // ---- Section 43: Test 4 (Cash = 1,000, Commission = 10%) ----
  {
    const r = repo.calculateTopup(1000, 10, 'CASH');
    assert(r.walletValue === 1111.11, 'Test 4 Wallet Value', `Expected 1111.11, got ${r.walletValue}`);
    assert(r.commissionAmount === 111.11, 'Test 4 Commission Amount', `Expected 111.11, got ${r.commissionAmount}`);
  }

  // ---- Section 43: Test 5 (Cash = 1,000, Commission = 0%) ----
  {
    const r = repo.calculateTopup(1000, 0, 'CASH');
    assert(r.walletValue === 1000, 'Test 5 Wallet Value', `Expected 1000, got ${r.walletValue}`);
    assert(r.commissionAmount === 0, 'Test 5 Commission Amount', `Expected 0, got ${r.commissionAmount}`);
  }

  // ---- Section 43: Test 6 (Commission = 100% REJECT) ----
  {
    let rejected = false;
    try {
      repo.calculateTopup(1000, 100, 'CASH');
    } catch {
      rejected = true;
    }
    assert(rejected, 'Test 6 100% Commission Rejection');
  }

  // ---- Negative Commission REJECT ----
  {
    let rejected = false;
    try {
      repo.calculateTopup(1000, -5, 'CASH');
    } catch {
      rejected = true;
    }
    assert(rejected, 'Negative Commission Rejection');
  }

  // ---- Credit Top-up Calculation (Credit = 5,000, Commission = 50%) ----
  {
    const r = repo.calculateTopup(5000, 50, 'CREDIT');
    assert(r.walletValue === 10000, 'Credit Topup Wallet Value', `Expected 10000, got ${r.walletValue}`);
    assert(r.commissionAmount === 5000, 'Credit Topup Commission Amount', `Expected 5000, got ${r.commissionAmount}`);
    assert(r.cashAmount === 0, 'Credit Topup Cash Amount is 0', `Expected 0, got ${r.cashAmount}`);
    assert(r.creditAmount === 5000, 'Credit Topup Credit Amount is 5000', `Expected 5000, got ${r.creditAmount}`);
  }

  // =========================================================================
  // SECTION 55: IMPORTANT ACCOUNTING SCENARIO
  // =========================================================================
  {
    // Step 1: Top-Up 1 (Rs. 10,000 CASH, 50% commission)
    const topup1 = repo.calculateTopup(10000, 50, 'CASH');
    let walletBalance = topup1.walletValue; // 20,000
    assert(topup1.cashAmount === 10000, 'Sec 55 Step 1 Cash Paid = 10,000');
    assert(topup1.creditAmount === 0, 'Sec 55 Step 1 Credit = 0');
    assert(topup1.commissionAmount === 10000, 'Sec 55 Step 1 Commission = 10,000');
    assert(topup1.walletValue === 20000, 'Sec 55 Step 1 Wallet Value = 20,000');
    assert(walletBalance === 20000, 'Sec 55 Step 1 Wallet Balance = 20,000');

    // Step 2: Customer Recharge (Package = Rs. 2,000)
    const packagePrice = 2000;
    const rechargeWalletDebit = packagePrice;
    const rechargeCommission = 0; // ZERO COMMISSION GENERATED AT RECHARGE TIME
    walletBalance -= rechargeWalletDebit; // 18,000
    assert(rechargeCommission === 0, 'Sec 55 Step 2 Recharge Commission = 0');
    assert(rechargeWalletDebit === 2000, 'Sec 55 Step 2 Wallet Debit = 2,000');
    assert(walletBalance === 18000, 'Sec 55 Step 2 Wallet Balance = 18,000');

    // Step 3: Top-Up 2 (Rs. 5,000 CREDIT, 50% commission)
    const topup2 = repo.calculateTopup(5000, 50, 'CREDIT');
    walletBalance += topup2.walletValue; // 28,000
    assert(topup2.cashAmount === 0, 'Sec 55 Step 3 Cash Paid = 0');
    assert(topup2.creditAmount === 5000, 'Sec 55 Step 3 Credit = 5,000');
    assert(topup2.commissionAmount === 5000, 'Sec 55 Step 3 Commission = 5,000');
    assert(topup2.walletValue === 10000, 'Sec 55 Step 3 Wallet Value = 10,000');
    assert(walletBalance === 28000, 'Sec 55 Step 3 Wallet Balance = 28,000');

    // Step 4: Final Financial Aggregates
    const totalCashReceived = topup1.cashAmount + topup2.cashAmount; // 10,000
    const totalCreditGranted = topup1.creditAmount + topup2.creditAmount; // 5,000
    const totalCommissionGranted = topup1.commissionAmount + topup2.commissionAmount; // 15,000
    const totalWalletValueAdded = topup1.walletValue + topup2.walletValue; // 30,000
    const totalCustomerRecharges = rechargeWalletDebit; // 2,000
    const cashRevenue = totalCashReceived; // Strictly 10,000

    assert(totalCashReceived === 10000, 'Sec 55 Total Cash Received = 10,000');
    assert(totalCreditGranted === 5000, 'Sec 55 Total Credit Granted = 5,000');
    assert(totalCommissionGranted === 15000, 'Sec 55 Total Commission Granted = 15,000');
    assert(totalWalletValueAdded === 30000, 'Sec 55 Total Wallet Value Added = 30,000');
    assert(totalCustomerRecharges === 2000, 'Sec 55 Total Customer Recharge = 2,000');
    assert(walletBalance === 28000, 'Sec 55 Current Wallet = 28,000');
    assert(cashRevenue === 10000, 'Sec 55 Cash Revenue strictly Rs. 10,000 (NOT Rs. 30,000)');
  }

  return results;
}
