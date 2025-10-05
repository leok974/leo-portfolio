from prometheus_client import Counter, Histogram

page_views = Counter("page_view_total", "Page views", ["path","ref_host","device","theme","region","ua_is_bot"])
dwell_seconds = Histogram("dwell_time_seconds", "Dwell time per session",
    buckets=(1,5,10,20,30,45,60,90,120,180,300,600))
scroll_depth = Counter("scroll_depth_percent_total", "Scroll depth events", ["path","percent"])
project_clicks = Counter("project_click_total", "Project clicks", ["project_id"])
project_hovers = Counter("project_hover_total", "Project hovers", ["project_id"])
project_expands = Counter("project_expand_total", "Project expands", ["project_id"])
project_plays = Counter("project_video_play_total", "Project video plays", ["project_id"])
agent_requests = Counter("agent_request_total", "Agent requests", ["intent","project_id"])
agent_feedback = Counter("agent_feedback_total", "Agent feedback", ["sentiment","intent"])
agent_latency = Histogram("agent_latency_seconds", "Agent response latency", ["intent","project_id"],
    buckets=(0.05,0.1,0.2,0.5,1,2,3,5,8,13))
frontend_errors = Counter("frontend_error_total", "Frontend error events", ["source"])
click_bins = Counter("click_bin_total", "Binned click coordinates", ["x_bin","y_bin","path"])
web_vitals_lcp = Histogram("web_vitals_lcp_seconds", "LCP seconds", ["path"],
    buckets=(0.5,1,1.5,2,2.5,3,4,5))
sessions_started = Counter("session_start_total", "Anonymous sessions started")

# Outbound link clicks (low-cardinality labels)
link_clicks = Counter(
    "link_click_total",
    "Outbound portfolio link clicks",
    ["kind", "href_domain"],  # kind ∈ {github, artstation, resume}; href_domain is hostname
)

# Server-side resume download counter (ground truth for JS-off or blocked beacons)
resume_downloads = Counter(
    "resume_download_total",
    "PDF resume downloads counted server-side",
)

# Visitors by day-of-week and hour-of-day (ET by default unless ANALYTICS_TZ overrides)
page_view_by_dow_hour = Counter(
    "page_view_by_dow_hour_total",
    "Page views bucketed by day-of-week (0=Mon..6=Sun) and hour-of-day (00..23) in configured timezone",
    ["dow", "hour"],
)

# Visitors by DOW/HOUR + low-cardinality path group
page_view_by_dow_hour_path = Counter(
    "page_view_by_dow_hour_path_total",
    "Page views bucketed by DOW (0..6), hour (00..23), and low-cardinality path_group",
    ["dow", "hour", "path_group"],
)

# Visitors by DOW/HOUR + path_group + device (low cardinality)
page_view_by_dow_hour_path_device = Counter(
    "page_view_by_dow_hour_path_device_total",
    "Page views bucketed by DOW (0..6), hour (00..23), low-cardinality path_group, and device",
    ["dow", "hour", "path_group", "device"],
)
