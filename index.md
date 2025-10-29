---
layout: home
title: "Industry Blog"
subtitle: "Latest News Show Here"
---

# 👋 Welcome！

這裡是我的知識庫和想法分享空間。請查看下方的最新文章。

<hr>

# Latest News List

{% for post in site.posts %}

  <article class="post-item">
    
    <h2>
      <a class="post-link" href="{{ post.url | relative_url }}">
        {{ post.title }}
      </a>
    </h2>

    <p class="post-meta">
      Post：{{ post.date | date: "%Y 年 %m 月 %d 日" }}
    </p>

    <div class="post-excerpt">
      {{ post.excerpt | strip_html | truncate: 150 }} 
      <p><a href="{{ post.url | relative_url }}">Read More &rarr;</a></p>
    </div>
    
  </article>

  <hr>

{% endfor %}
<p style="text-align: center;">本網站由 GitHub Pages 及 Jekyll 自動生成。</p>
