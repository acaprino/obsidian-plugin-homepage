import { BaseBlock } from './BaseBlock';

export class SpacerBlock extends BaseBlock {
  render(el: HTMLElement): void {
    el.addClass('spacer-block');
  }
}
