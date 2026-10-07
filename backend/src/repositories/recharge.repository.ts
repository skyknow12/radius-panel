import { billingRepository, ProcessRechargeInput, BillingTransactionRecord } from './billing.repository';

export interface PackagePriceRecord {
  id: number;
  package_id: number;
  duration_months: number;
  price: string;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RechargeTransactionRecord extends BillingTransactionRecord {}

export interface CreateRechargeInput {
  subscriber_id: number;
  package_id: number;
  duration_months: number;
  amount: number;
  currency?: string;
  payment_method?: string;
  payment_reference?: string;
  discount_type?: 'none' | 'fixed' | 'percentage';
  discount_value?: number;
  created_by?: string;
  notes?: string;
  idempotency_key?: string;
}

export const rechargeRepository = {
  async getPackagePrices(packageId: number): Promise<PackagePriceRecord[]> {
    return billingRepository.getPackagePrices(packageId);
  },

  async setPackagePrice(
    packageId: number,
    durationMonths: number,
    price: number,
    currency = 'NPR',
    changedBy = 'admin',
    reason = 'Package price updated',
  ): Promise<PackagePriceRecord> {
    return billingRepository.setPackagePrice(packageId, durationMonths, price, currency, changedBy, reason);
  },

  async listTransactions(
    options: { subscriberId?: number; limit?: number; offset?: number } = {},
  ): Promise<{ items: RechargeTransactionRecord[]; total: number }> {
    return billingRepository.listTransactions(options);
  },

  async processRecharge(input: CreateRechargeInput): Promise<RechargeTransactionRecord> {
    const res = await billingRepository.processRecharge({
      subscriber_id: input.subscriber_id,
      package_id: input.package_id,
      duration_months: input.duration_months,
      original_price: input.amount,
      discount_type: input.discount_type || 'none',
      discount_value: input.discount_value || 0,
      payment_method: input.payment_method || 'Cash',
      payment_reference: input.payment_reference,
      notes: input.notes,
      idempotency_key: input.idempotency_key,
      created_by: input.created_by || 'admin',
    });
    return res.transaction;
  },
};
