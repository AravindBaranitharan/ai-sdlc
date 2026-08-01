import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUrl, Length } from "class-validator";

export class CreateRunDto {
  @IsString()
  @Length(2, 80)
  projectName!: string;

  @IsUrl({ require_tld: false })
  targetUrl!: string;

  @IsString()
  @Length(8, 300)
  goal!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  personaIds!: string[];
}
