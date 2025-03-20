import fs from "fs";
import Compiler, { Logger, formatString, ANSIColor } from "../Compiler";

import { vi, expect, test, beforeEach, assert, describe } from "vitest";
import { ViewArgs } from "../types";

const compileString = async (str: string, args: ViewArgs): Promise<string> => {
    vi.spyOn(fs.promises, "readFile").mockReturnValueOnce(Promise.resolve(str));
    const compiler = new Compiler();
    const view = await compiler.compileFile("");
    assert(view !== null);
    return view(args);
};

const expectCompileError = async (str: string, line: number, col: number, msg: string) => {
    const logger = {
        error: vi.fn(),
    };

    vi.spyOn(fs.promises, "readFile").mockReturnValueOnce(Promise.resolve(str));
    const compiler = new Compiler(logger as Logger);
    await compiler.compileFile("");

    const numbers = formatString(ANSIColor.RED, `:${line}:${col}`);
    const error = formatString(ANSIColor.RED, "ERROR:");

    expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`${numbers}\n${error} ${msg}`)
    );
};

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("Variable", () => {
    test("simple variable", async () => {
        const template = "<h1>{{ foo }}</h1>";
        expect(
            await compileString(template, { foo: "bar" })
        ).toBe("<h1>bar</h1>");
    });

    test("object variable", async () => {
        const template = "<h1>{{ foo.bar }}</h1>";
        const args = { foo: { bar: "baz" } };
        expect(
            await compileString(template, args)
        ).toBe("<h1>baz</h1>");
    });

    test("array", async () => {
        const template = "<h1>{{ foo[0] }}</h1>";
        expect(
            await compileString(template, { foo: ["bar"] })
        ).toBe("<h1>bar</h1>");
    });

    test("array and object", async () => {
        const template = "<h1>{{ foo[0].bar }}</h1>";
        const args = { foo: [{ bar: "baz"}] };
        expect(
            await compileString(template, args)
        ).toBe("<h1>baz</h1>");
    });

    test("variable name using $ and _", async () => {
        const template = "<h1>{{ $foo_bar }}</h1>";
        const args = { $foo_bar: "baz" };
        expect(
            await compileString(template, args)
        ).toBe("<h1>baz</h1>");
    });

    test("variable name starts with a number", async () => {
        const template = "<h1>{{ 2hello }}</h1>";
        expectCompileError(template, 1, 8, "Expected identifier before number");
    });
});

describe("If", () => {
    describe("Unary", () => {
        test("Simple", async () => {
            const template = "{{if(condition)}}foo{{endif}}";
            expect(
                await compileString(template, { condition: true })
            ).toBe("foo");
            expect(
                await compileString(template, { condition: false })
            ).toBe("");
        });
        test("Negated", async () => {
            const template = "{{if(!condition)}}foo{{endif}}";
            expect(
                await compileString(template, { condition: false })
            ).toBe("foo");
            expect(
                await compileString(template, { condition: true })
            ).toBe("");
        });
    });

    describe("Binary", () => {
        test("Equal", async () => {
            const template = "{{if(foo == bar)}}ok{{endif}}";
            // Numbers
            expect(
                await compileString(template, { foo: 5, bar: 5 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 3, bar: 5 })
            ).toBe("");
            // String
            expect(
                await compileString(template, { foo: "baz", bar: "baz" })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: "baz", bar: "apple" })
            ).toBe("");
        });

        test("Not Equal", async () => {
            const template = "{{if(foo != bar)}}ok{{endif}}";
            // Numbers
            expect(
                await compileString(template, { foo: 3, bar: 5 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 5, bar: 5 })
            ).toBe("");
            // String
            expect(
                await compileString(template, { foo: "baz", bar: "apple" })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: "baz", bar: "baz" })
            ).toBe("");
        });

        test("Greather than", async () => {
            const template = "{{if(foo > bar)}}ok{{endif}}";
            expect(
                await compileString(template, { foo: 10, bar: 5 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 1, bar: 5 })
            ).toBe("");
        });

        test("Less than", async () => {
            const template = "{{if(foo < bar)}}ok{{endif}}";
            expect(
                await compileString(template, { foo: 1, bar: 5 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 10, bar: 5 })
            ).toBe("");
        });

        test("Greather or equal than", async () => {
            const template = "{{if(foo >= bar)}}ok{{endif}}";
            expect(
                await compileString(template, { foo: 10, bar: 10 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 15, bar: 10 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 1, bar: 5 })
            ).toBe("");
        });

        test("Less or equal than", async () => {
            const template = "{{if(foo <= bar)}}ok{{endif}}";
            expect(
                await compileString(template, { foo: 10, bar: 10 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 5, bar: 10 })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: 10, bar: 5 })
            ).toBe("");
        });

        test("And", async () => {
            const template = "{{if(foo && bar)}}ok{{endif}}";
            expect(
                await compileString(template, { foo: true, bar: true })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: false, bar: true })
            ).toBe("");
            expect(
                await compileString(template, { foo: true, bar: false })
            ).toBe("");
        });

        test("Or", async () => {
            const template = "{{if(foo || bar)}}ok{{endif}}";
            expect(
                await compileString(template, { foo: true, bar: true })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: false, bar: true })
            ).toBe("ok");
            expect(
                await compileString(template, { foo: false, bar: false })
            ).toBe("");
        });
    });

    describe("Errors", () => {
        test("binary without operation", async () => {
            const template = "{{if(var1 var2)}}{{endif}}";
            expectCompileError(template, 1, 10, "Expected operator");
        });

        test("when no endif found", () => {
            const template = "{{if(var1)}}";
            expectCompileError(template, 1, 3, "Unterminated if");
        });
    });
});
