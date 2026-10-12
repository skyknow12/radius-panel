import type { OltVendor } from './types';
import { HuaweiAdapter } from './huawei-adapter';
import { BdcomAdapter, GenericAdapter, PowertechAdapter, VsolAdapter, type OltVendorAdapter } from './generic-adapter';

export function getVendorAdapter(vendor: string): OltVendorAdapter {
  const norm = (vendor || '').trim().toLowerCase();

  switch (norm) {
    case 'huawei':
      return new HuaweiAdapter();
    case 'bdcom':
      return new BdcomAdapter();
    case 'powertech':
      return new PowertechAdapter();
    case 'vsol':
      return new VsolAdapter();
    default:
      return new GenericAdapter(vendor as OltVendor);
  }
}
