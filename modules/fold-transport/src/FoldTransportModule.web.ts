import { registerWebModule, NativeModule } from 'expo';

import { FoldTransportModuleEvents } from './FoldTransport.types';

class FoldTransportModule extends NativeModule<FoldTransportModuleEvents> {}

export default registerWebModule(FoldTransportModule, 'FoldTransportModule');
