import { map } from "../template";
import { baseTemplate } from "./shared";

function p(str: string) {
    return `
    <p>${str}</p>
    `;
}

export default function (strings: string[]) {
    const body = `
    <div class="uwu">${map(strings, (str) => p(str))}</div>
    `;

    return baseTemplate("Home", body);
}
