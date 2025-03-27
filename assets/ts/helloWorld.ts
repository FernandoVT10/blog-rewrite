import {
    init,
    classModule,
    propsModule,
    styleModule,
    eventListenersModule,
    h,
    VNode
} from "snabbdom";

const patch = init([
    classModule,
    propsModule,
    styleModule,
    eventListenersModule,
]);

function button(count: number): VNode {
    return h("button", {
        on: { click: () => {update(count + 1)}}
    }, `Count: ${count}`);
}

let vNode: VNode;

function update(state: number) {
    vNode = patch(vNode, button(state));
}

window.addEventListener("load", () => {
    const container = document.getElementById("container") as HTMLDivElement;
    vNode = patch(container, button(0));
});
