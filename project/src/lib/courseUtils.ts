export const safeToDate = (v: any): Date => {
    if (!v) return new Date();
    if (typeof v.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
};

export const computeStatus = (
    trainerExists: boolean,
    sessionEndDate: Date,
    courseEndDate: Date
): "active" | "draft" | "completed" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!trainerExists) return "draft";

    const e = safeToDate(sessionEndDate);
    const ce = safeToDate(courseEndDate);
    e.setHours(0, 0, 0, 0);
    ce.setHours(0, 0, 0, 0);

    if (today > ce || today > e) return "completed";

    // If trainer exists and it's not completed, it's active
    return "active";
};
