import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerVisaDeliveries from "./CustomerVisaDeliveries";

const mock = vi.hoisted(() => ({ language: "ar", query: vi.fn(), refetch: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: mock.language } }) }));
vi.mock("@/providers/trpc-client", () => ({ trpc: {
  operationsVisaDelivery: { customerList: { useQuery: mock.query } },
  useUtils: () => ({ operationsVisaDelivery: { customerDownload: { fetch: vi.fn() } } }),
} }));
const files = [
  { deliveryId: "first", applicantId: 2, visaReference: "VISA-B", validitySummary: "Second validity", customerInstructions: ["Second instruction"] },
  { deliveryId: "second", applicantId: 1, visaReference: "VISA-A", validitySummary: "First validity", customerInstructions: ["First instruction"] },
];
const render = () => renderToStaticMarkup(<CustomerVisaDeliveries referenceNumber="TSH-TEST" applicants={[{ id: 1, name: "First traveller" }, { id: 2, name: "Second traveller" }]} />);
describe("CustomerVisaDeliveries", () => {
  beforeEach(() => { mock.language = "ar"; mock.query.mockReturnValue({ data: files, refetch: mock.refetch }); });
  it("binds family names by applicant identity, not array order, and shows saved instructions", () => {
    const html = render();
    expect(html.indexOf("Second traveller")).toBeLessThan(html.indexOf("VISA-B"));
    expect(html.indexOf("VISA-B")).toBeLessThan(html.indexOf("First traveller"));
    expect(html).toContain("First instruction");
    expect(html).toContain("Second instruction");
    expect(html).toContain('dir="rtl"');
    expect(html.match(/تنزيل التأشيرة/g)).toHaveLength(2);
    expect(mock.query).toHaveBeenCalledWith({ applicationReference: "TSH-TEST" }, { retry: false });
  });
  it("supports English", () => { mock.language = "en"; expect(render()).toContain("Download visa"); });
  it("does not call an empty delivery list ready", () => { mock.query.mockReturnValue({ data: [] }); expect(render()).toBe(""); });
  it("shows a retry when listing fails rather than hiding the failure", () => { mock.query.mockReturnValue({ error: new Error("private diagnostic"), refetch: mock.refetch }); const html = render(); expect(html).toContain("إعادة المحاولة"); expect(html).not.toContain("private diagnostic"); });
  it("shows loading without claiming the files are ready", () => { mock.query.mockReturnValue({ isLoading: true }); expect(render()).toContain("جارٍ تحميل التأشيرات"); expect(render()).not.toContain("جاهزة للتنزيل"); });
});
