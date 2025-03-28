import { prop, getModelForClass } from "@typegoose/typegoose";

const BP_COVER_MAX_LENGTH = 100;
const BP_TITLE_MAX_LENGTH = 100;
const BP_CONTENT_MAX_LENGTH = 5000;

export class BlogPost {
    @prop({ maxlength: BP_COVER_MAX_LENGTH, minlength: 1, required: true })
    public cover!: string;

    @prop({ maxlength: BP_TITLE_MAX_LENGTH, minlength: 1, required: true })
    public title!: string;

    @prop({ maxlength: BP_CONTENT_MAX_LENGTH, minlength: 1, required: true })
    public content!: string;
}

export const BlogPostModel = getModelForClass(BlogPost);

const PROJECT_COVER_MAX_LENGTH = 100;
const PROJECT_NAME_MAX_LENGTH = 100;
const PROJECT_DESCRIPTION_MAX_LENGTH = 500;
const PROJECT_LINK_MAX_LENGTH = 200;

export class Project {
    @prop({ maxlength: PROJECT_COVER_MAX_LENGTH, minlength: 1, required: true })
    public cover!: string;

    @prop({ maxlength: PROJECT_NAME_MAX_LENGTH, minlength: 1, required: true })
    public name!: string;

    @prop({ maxlength: PROJECT_DESCRIPTION_MAX_LENGTH, minlength: 1, required: true })
    public description!: string;

    @prop({ maxlength: PROJECT_LINK_MAX_LENGTH, minlength: 1, required: true })
    public link!: string;
}

export const ProjectModel = getModelForClass(Project);
