import { GenericWebAdapter } from './generic-web.adapter';
import { HuaweiWebAdapter } from './huawei-web.adapter';
import type { OnuManagementAdapter } from './types';
import { UnsupportedAdapter } from './unsupported.adapter';
import { ZteWebAdapter } from './zte-web.adapter';

export function getOnuAdapter(adapterType?: string | null): OnuManagementAdapter {
  const norm = (adapterType || '').trim().toLowerCase();

  switch (norm) {
    case 'huawei_web':
    case 'huawei':
      return new HuaweiWebAdapter();
    case 'zte_web':
    case 'zte':
      return new ZteWebAdapter();
    case 'generic_web':
    case 'generic':
      return new GenericWebAdapter();
    case 'unsupported':
      return new UnsupportedAdapter();
    default:
      return new GenericWebAdapter();
  }
}
