import { expect, test, describe } from "vitest";

import TemplateEngine from "./TemplateEngine";
import Lexer from "./TemplateEngine/Lexer";
import Parser from "./TemplateEngine/Parser";

const compileString = (str: string, args?: any): string => {
    const lexer = new Lexer(str, "./src/test.html");
    const parser = new Parser(lexer.scanTokens());
    return TemplateEngine.compileNodes(parser.parse(), args);
};

test("returns the same string if there's no expressions", () => {
    const template = "<h1></h1>";
    expect(compileString(template)).toBe(template);
});

describe("Variable", () => {
    test("simple variable", () => {
        const template = "<h1>{{ foo }}</h1>";
        expect(compileString(template, {
            foo: "bar",
        })).toBe("<h1>bar</h1>");
    });

    test("object variable", () => {
        const template = "<h1>{{ foo.bar }}</h1>";
        expect(compileString(template, {
            foo: { bar: "baz" },
        })).toBe("<h1>baz</h1>");
    });

    test("array", () => {
        const template = "<h1>{{ foo[0] }}</h1>";
        expect(compileString(template, {
            foo: ["bar"],
        })).toBe("<h1>bar</h1>");
    });

    test("array containing objects", () => {
        const template = "<h1>{{ foo[0].bar }}</h1>";
        expect(compileString(template, {
            foo: [ { bar: ["baz"] } ],
        })).toBe("<h1>baz</h1>");
    });

    test("variable name using _$", () => {
        const template = "<h1>{{ $foo_2 }}</h1>";
        expect(compileString(template, {
            $foo_2: "bar",
        })).toBe("<h1>bar</h1>");
    });

    test("throws when variable name starts with number", () => {
        const template = "<h1>{{ 2foo }}</h1>";
        expect(() => compileString(template)).toThrowError();
    });

    test("throws when array index is not a number", () => {
        const template = "<h1>{{ foo[hello] }}</h1>";
        expect(() => compileString(template)).toThrowError();
    });
});

describe("If", () => {
    describe("Unary", () => {
        test("Simple", () => {
            const template = "{{if(condition)}}foo{{endif}}";
            expect(compileString(template, { condition: true })).toBe("foo");
            expect(compileString(template, { condition: false })).toBe("");
        });

        test("Negated", () => {
            const template = "{{if(!condition)}}foo{{endif}}";
            expect(compileString(template, { condition: true })).toBe("");
            expect(compileString(template, { condition: false })).toBe("foo");
        });
    });

    describe("Binary", () => {
        test("Equal", () => {
            const template = "{{if(foo == bar)}}ok{{endif}}";
            expect(compileString(template, { foo: 5, bar: 5 })).toBe("ok");
            expect(compileString(template, { foo: 3, bar: 5 })).toBe("");

            expect(
                compileString(template, { foo: "baz", bar: "baz" })
            ).toBe("ok");
            expect(
                compileString(template, { foo: "foo", bar: "bar" })
            ).toBe("");
        });

        test("Not Equal", () => {
            const template = "{{if(foo != bar)}}ok{{endif}}";
            expect(compileString(template, { foo: 5, bar: 5 })).toBe("");
            expect(compileString(template, { foo: 3, bar: 5 })).toBe("ok");

            expect(
                compileString(template, { foo: "baz", bar: "baz" })
            ).toBe("");
            expect(
                compileString(template, { foo: "foo", bar: "bar" })
            ).toBe("ok");
        });

        test("Greather than", () => {
            const template = "{{if(foo > bar)}}ok{{endif}}";
            expect(compileString(template, { foo: 6, bar: 5 })).toBe("ok");
            expect(compileString(template, { foo: 5, bar: 5 })).toBe("");
        });

        test("Less than", () => {
            const template = "{{if(foo < bar)}}ok{{endif}}";
            expect(compileString(template, { foo: 6, bar: 5 })).toBe("");
            expect(compileString(template, { foo: 5, bar: 6 })).toBe("ok");
        });

        test("Greather or equal than", () => {
            const template = "{{if(foo >= bar)}}ok{{endif}}";
            expect(compileString(template, { foo: 6, bar: 6 })).toBe("ok");
            expect(compileString(template, { foo: 6, bar: 5 })).toBe("ok");
            expect(compileString(template, { foo: 5, bar: 7 })).toBe("");
        });

        test("Less or equal than", () => {
            const template = "{{if(foo <= bar)}}ok{{endif}}";
            expect(compileString(template, { foo: 6, bar: 6 })).toBe("ok");
            expect(compileString(template, { foo: 5, bar: 6 })).toBe("ok");
            expect(compileString(template, { foo: 7, bar: 5 })).toBe("");
        });

        test("And", () => {
            let template = "{{if(foo && bar)}}ok{{endif}}";
            expect(compileString(template, { foo: true, bar: true })).toBe("ok");
            expect(compileString(template, { foo: true, bar: false })).toBe("");

            template = "{{if(foo > 5 && bar)}}ok{{endif}}";
            expect(compileString(template, { foo: 10, bar: true })).toBe("ok");
        });
    });

    test("should allow numbers in unary expression", () => {
        expect(
            compileString("{{if(6)}}ok{{endif}}")
        ).toBe("ok");

        expect(
            compileString("{{if(0)}}ok{{endif}}")
        ).toBe("");
    });

    test("should allow numbers in binary expression", () => {
        expect(
            compileString("{{if(6 == 6)}}ok{{endif}}")
        ).toBe("ok");

        expect(
            compileString("{{if(6 < 6)}}ok{{endif}}")
        ).toBe("");

        expect(
            compileString("{{if(foo > 10)}}ok{{endif}}", { foo: 15 })
        ).toBe("ok");
    });

    test("should allow strings in unary expression", () => {
        expect(
            compileString('{{if("hello")}}ok{{endif}}')
        ).toBe("ok");
    });

    test("should allow strings in binary expression", () => {
        expect(
            compileString('{{if("foo" == "foo")}}ok{{endif}}')
        ).toBe("ok");

        expect(
            compileString('{{if("foo" == "bar")}}ok{{endif}}')
        ).toBe("");

        expect(
            compileString('{{if(foo == "bar")}}ok{{endif}}', { foo: "bar" })
        ).toBe("ok");
    });

    test("throws when endif is not found", () => {
        const template = "{{if(condition)}}foo";
        expect(() => compileString(template)).toThrowError();
    });

    test("throws when open parenthesis is not found", () => {
        const template = "{{if condition)}}foo{{endif}}";
        expect(() => compileString(template)).toThrowError();
    });

    test("throws when closing parenthesis is not found", () => {
        const template = "{{if (condition }}foo{{endif}}";
        expect(() => compileString(template)).toThrowError();
    });
});
