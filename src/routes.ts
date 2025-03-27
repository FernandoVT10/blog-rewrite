import { Router } from "express";
import TemplateEngine, { Views } from "./TemplateEngine";

const router = Router();

const blogPosts = [
    {
        id: 1,
        cover: "https://fvtblog.com/assets/covers/blog/4763-1733785494372.webp",
        title: "Test Card",
    },
    {
        id: 2,
        cover: "https://fvtblog.com/assets/covers/blog/8014-1732749325489.webp",
        title: "Test Card #2",
    }
];

router.get("/", (_, res) => {
    TemplateEngine.sendView(res, {
        view: Views.HOME,
        viewArgs: { blogPosts },
        layoutArgs: { title: "Fernando Vaca Tamayo" },
    });
});

router.get("/blog", (_, res) => {
    TemplateEngine.sendView(res, {
        view: Views.BLOG,
        viewArgs: { blogPosts },
        layoutArgs: { title: "Blog" },
    });
});

export default router;
