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

const compileError = async (str: string) => {
    const logger = {
        error: vi.fn(),
    };

    vi.spyOn(fs.promises, "readFile").mockReturnValueOnce(Promise.resolve(str));
    const compiler = new Compiler(logger as Logger);
    await compiler.compileFile("");

    const lastCall = logger.error.mock.lastCall;
    assert(lastCall !== undefined, "logger.error wasn't called");

    const msg = lastCall[0];
    const errorMsg = msg.split("\n")[1];


    const error = formatString(ANSIColor.RED, "ERROR:") + " ";
    return errorMsg.replace(error, "");
};

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("Expression Syntax Errors", () => {
    test("is not closed with }}", async () => {
        const template = "{{ message";
        expect(
            await compileError(template)
        ).toBe('Expected closing "}}"');
    });

    test("contains only a number", async () => {
        const template = "{{ 17 }}";
        expect(
            await compileError(template)
        ).toBe("Expected expression before number");
    });

    test("empty expression", async () => {
        const template = "{{}}";
        expect(
            await compileError(template)
        ).toBe("Invalid empty expression");
    });
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

    describe("Syntax Errors", () => {
        test("variable name starts with a number", async () => {
            const template = "<h1>{{ 2hello }}</h1>";
            expect(
                await compileError(template)
            ).toBe("Expected expression before number");
        });

        test("dot is not followed by identifier", async () => {
            const template = "{{ hello. }}";
            expect(
                await compileError(template)
            ).toBe('Expected property name after "."');
        });

        test("array without index", async () => {
            const template = "{{ hello[] }}";
            expect(
                await compileError(template)
            ).toBe('Expected array index after "["');
        });

        test("array without closing bracket", async () => {
            const template = "{{ hello[0 }}";
            expect(
                await compileError(template)
            ).toBe('Expected "]" after index');
        });
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

    describe("Syntax Error", () => {
        test("( is not added", async () => {
            const template = "{{ if hello) }}";
            expect(
                await compileError(template)
            ).toBe('Expected "(" after "if"');
        });

        test(") is not added", async () => {
            const template = "{{ if(foo }}";
            expect(
                await compileError(template)
            ).toBe('Expected ")" after condition');
        });

        test("}} is not added at the end of the satement", async () => {
            const template = "{{ if(foo)";
            expect(
                await compileError(template)
            ).toBe('Expected "}}" after "if" statement');
        });

        test("binary without operation", async () => {
            const template = "{{if(var1 var2)}}{{endif}}";
            expect(
                await compileError(template)
            ).toBe('Expected operator after expression');
        });

        test("when no endif found", async () => {
            const template = "{{if(var1)}}";
            expect(
                await compileError(template)
            ).toBe("Unterminated if statement");
        });
    });
});

describe("For", () => {
    test("works fine", async () => {
        const template = "{{for(string in strings)}}<p>{{string}}</p>{{endfor}}";
        expect(
            await compileString(template, {
                strings: ["foo", "bar", "baz"]
            })
        ).toBe("<p>foo</p><p>bar</p><p>baz</p>");
    });

    describe("Syntax Errors", () => {
        test("( is not added", async () => {
            const template = "{{ for hello }}";
            expect(
                await compileError(template)
            ).toBe('Expected "(" after "for"');
        });

        test("expression after ( is not added", async () => {
            const template = "{{ for( }}";
            expect(
                await compileError(template)
            ).toBe('Expected declaration after "("');
        });

        test("in keyword is not added", async () => {
            const template = "{{ for(test tests) }}";
            expect(
                await compileError(template)
            ).toBe('Expected "in" keyword after declaration');
        });

        test("array name is not added", async () => {
            const template = "{{ for(test in) }}";
            expect(
                await compileError(template)
            ).toBe('Expected variable after "in"');
        });

        test(") is not added", async () => {
            const template = "{{ for(test in tests }}";
            expect(
                await compileError(template)
            ).toBe('Expected ")" after expression');
        });

        test("}} is not added", async () => {
            const template = "{{ for(test in tests)";
            expect(
                await compileError(template)
            ).toBe('Expected "}}" after "for" statement');
        });

        test("when no endfor found", async () => {
            const template = "{{for(string in strings)}}<p>{{string}}</p>";
            expect(
                await compileError(template)
            ).toBe("Unterminated for statement");
        });
    });
});
