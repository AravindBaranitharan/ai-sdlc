import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from "class-validator";

export class CreateRunDto {
  @IsString()
  @Length(2, 80)
  projectName!: string;

  @IsUrl({ require_tld: false })
  targetUrl!: string;

  @IsString()
  @Length(8, 300)
  goal!: string;

  @IsString()
  @Length(8, 300)
  successCriteria!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  personaIds!: string[];
}

export class ReviewFindingDto {
  @IsIn(["Approved", "Dismissed"])
  status!: "Approved" | "Dismissed";

  @IsOptional()
  @IsString()
  @Length(2, 240)
  note?: string;
}

export class CreatePersonaDto {
  @IsString()
  @Length(2, 60)
  name!: string;

  @IsString()
  @Length(8, 240)
  description!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  traits!: string[];

  @IsInt()
  @Min(0)
  @Max(100)
  patience!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  confidence!: number;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  accessibility?: string;
}
