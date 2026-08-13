import { ArrayNotEmpty, IsInt } from 'class-validator';

export class BulkDeleteCustomersDto {
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids: number[];
}
