import { RenderOptions, Exporter } from './interfaces';
export declare function render(exporter: Exporter, options: RenderOptions): Promise<any>;
export declare function iterableRender(exporter: Exporter, options: RenderOptions): AsyncGenerator<void, boolean, unknown>;
