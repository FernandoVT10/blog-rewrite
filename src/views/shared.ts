import { cssFile } from "../template";

export function baseTemplate(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html>
    <head>
        <title>${title}</title>
        ${cssFile("./main.css")}
    </head>
    <body>${content}</body>
</html>
    `;
}
