import { BlockFactory, BlockType } from './types';

class BlockRegistryClass {
  private factories = new Map<BlockType, BlockFactory>();

  register(factory: BlockFactory): void {
    this.factories.set(factory.type, factory);
  }

  get(type: BlockType): BlockFactory | undefined {
    return this.factories.get(type);
  }

  getAll(): BlockFactory[] {
    return Array.from(this.factories.values());
  }

  clear(): void {
    this.factories.clear();
  }
}

export const BlockRegistry = new BlockRegistryClass();
