import { screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { UsersPage } from "./UsersPage.js";
import api from "../lib/api.js";
import { renderWithQuery } from "../test/renderWithQuery.js";

vi.mock("../lib/api.js", () => ({
  default: { get: vi.fn() },
}));

const mockedApi = vi.mocked(api);

function renderPage() {
  return renderWithQuery(<UsersPage />);
}

const USERS = [
  {
    id: "1",
    name: "Alice Admin",
    email: "alice@example.com",
    role: "Admin" as const,
    createdAt: "2024-01-15T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Bob Agent",
    email: "bob@example.com",
    role: "User" as const,
    createdAt: "2024-03-20T00:00:00.000Z",
  },
];

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeletons while loading", () => {
    // Never resolves — keeps component in pending state
    mockedApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    // 5 skeleton rows, each with 5 skeletons = 25 total
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders user rows with correct data", async () => {
    mockedApi.get.mockResolvedValue({ data: USERS });
    renderPage();

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Agent")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("shows correct role badges", async () => {
    mockedApi.get.mockResolvedValue({ data: USERS });
    renderPage();

    await screen.findByText("Alice Admin");

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("renders an empty table when no users are returned", async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    renderPage();

    // Table headers should still be visible
    expect(await screen.findByText("Name")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /alice/i })).not.toBeInTheDocument();
  });
});
