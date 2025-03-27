import { Router } from "express";
import TemplateEngine, { Views } from "./TemplateEngine";

const router = Router();

const blogPosts = [
    {
        id: 1,
        cover: "https://fvtblog.com/assets/covers/blog/4763-1733785494372.webp",
        title: "Test Card",
    },
];

router.get("/", (_, res) => {
    TemplateEngine.sendView(res, {
        view: Views.HOME,
        viewArgs: { blogPosts },
        layoutArgs: { title: "Fernando Vaca Tamayo" },
    });
});

export default router;
