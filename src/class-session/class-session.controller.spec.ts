import { Test, TestingModule } from '@nestjs/testing';
import { ClassSessionController } from './class-session.controller';

describe('ClassSessionController', () => {
  let controller: ClassSessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassSessionController],
    }).compile();

    controller = module.get<ClassSessionController>(ClassSessionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
