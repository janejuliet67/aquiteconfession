$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class RazanePoseTools
{
    public static Bitmap Crop(Bitmap source, Rectangle rect)
    {
        return source.Clone(rect, PixelFormat.Format32bppArgb);
    }

    public static void ClearEdgeBackground(Bitmap bitmap, int tolerance)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);

        try
        {
            int width = bitmap.Width;
            int height = bitmap.Height;
            int stride = data.Stride;
            byte[] pixels = new byte[stride * height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

            Color border = AverageBorderColor(pixels, width, height, stride);
            bool[] visited = new bool[width * height];
            Queue<int> queue = new Queue<int>();

            Action<int, int> tryEnqueue = (x, y) =>
            {
                if (x < 0 || y < 0 || x >= width || y >= height)
                {
                    return;
                }

                int flat = y * width + x;
                if (visited[flat])
                {
                    return;
                }

                visited[flat] = true;
                int offset = y * stride + x * 4;
                if (pixels[offset + 3] == 0)
                {
                    return;
                }

                int distance =
                    Math.Abs(pixels[offset + 2] - border.R) +
                    Math.Abs(pixels[offset + 1] - border.G) +
                    Math.Abs(pixels[offset + 0] - border.B);

                if (distance > tolerance)
                {
                    return;
                }

                queue.Enqueue(flat);
            };

            for (int x = 0; x < width; x++)
            {
                tryEnqueue(x, 0);
                tryEnqueue(x, height - 1);
            }

            for (int y = 0; y < height; y++)
            {
                tryEnqueue(0, y);
                tryEnqueue(width - 1, y);
            }

            while (queue.Count > 0)
            {
                int flat = queue.Dequeue();
                int x = flat % width;
                int y = flat / width;
                int offset = y * stride + x * 4;
                pixels[offset + 3] = 0;

                tryEnqueue(x + 1, y);
                tryEnqueue(x - 1, y);
                tryEnqueue(x, y + 1);
                tryEnqueue(x, y - 1);
            }

            Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }

    public static Bitmap Trim(Bitmap bitmap, int padding)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        Rectangle crop = Rectangle.Empty;
        bool hasPixels = false;

        try
        {
            int width = bitmap.Width;
            int height = bitmap.Height;
            int stride = data.Stride;
            byte[] pixels = new byte[stride * height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

            int minX = width;
            int minY = height;
            int maxX = -1;
            int maxY = -1;

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    if (pixels[y * stride + x * 4 + 3] == 0)
                    {
                        continue;
                    }

                    minX = Math.Min(minX, x);
                    minY = Math.Min(minY, y);
                    maxX = Math.Max(maxX, x);
                    maxY = Math.Max(maxY, y);
                }
            }

            if (maxX >= minX && maxY >= minY)
            {
                crop = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
                hasPixels = true;
            }
        }
        finally
        {
            bitmap.UnlockBits(data);
        }

        if (!hasPixels)
        {
            return new Bitmap(bitmap);
        }

        Bitmap trimmed = new Bitmap(crop.Width + padding * 2, crop.Height + padding * 2, PixelFormat.Format32bppArgb);

        using (Graphics graphics = Graphics.FromImage(trimmed))
        {
            graphics.Clear(Color.Transparent);
            graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
            graphics.PixelOffsetMode = PixelOffsetMode.Half;
            graphics.DrawImage(bitmap, new Rectangle(padding, padding, crop.Width, crop.Height), crop, GraphicsUnit.Pixel);
        }

        return trimmed;
    }

    public static void RemoveSmallOpaqueRegions(Bitmap bitmap, int minSize)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);

        try
        {
            int width = bitmap.Width;
            int height = bitmap.Height;
            int stride = data.Stride;
            byte[] pixels = new byte[stride * height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

            bool[] visited = new bool[width * height];

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int flat = y * width + x;
                    if (visited[flat])
                    {
                        continue;
                    }

                    visited[flat] = true;
                    int offset = y * stride + x * 4;
                    if (pixels[offset + 3] == 0)
                    {
                        continue;
                    }

                    List<int> component = new List<int>();
                    Queue<int> queue = new Queue<int>();
                    queue.Enqueue(flat);

                    while (queue.Count > 0)
                    {
                        int current = queue.Dequeue();
                        component.Add(current);
                        int cx = current % width;
                        int cy = current / width;

                        int[,] neighbors = new int[,] { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } };
                        for (int i = 0; i < 4; i++)
                        {
                            int nx = cx + neighbors[i, 0];
                            int ny = cy + neighbors[i, 1];
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height)
                            {
                                continue;
                            }

                            int nextFlat = ny * width + nx;
                            if (visited[nextFlat])
                            {
                                continue;
                            }

                            visited[nextFlat] = true;
                            int nextOffset = ny * stride + nx * 4;
                            if (pixels[nextOffset + 3] == 0)
                            {
                                continue;
                            }

                            queue.Enqueue(nextFlat);
                        }
                    }

                    if (component.Count < minSize)
                    {
                        foreach (int componentFlat in component)
                        {
                            int componentX = componentFlat % width;
                            int componentY = componentFlat / width;
                            int componentOffset = componentY * stride + componentX * 4;
                            pixels[componentOffset + 3] = 0;
                        }
                    }
                }
            }

            Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }

    private static Color AverageBorderColor(byte[] pixels, int width, int height, int stride)
    {
        long r = 0;
        long g = 0;
        long b = 0;
        long count = 0;

        Action<int, int> read = (x, y) =>
        {
            int offset = y * stride + x * 4;
            r += pixels[offset + 2];
            g += pixels[offset + 1];
            b += pixels[offset + 0];
            count += 1;
        };

        for (int x = 0; x < width; x++)
        {
            read(x, 0);
            read(x, height - 1);
        }

        for (int y = 1; y < height - 1; y++)
        {
            read(0, y);
            read(width - 1, y);
        }

        if (count == 0)
        {
            return Color.Black;
        }

        return Color.FromArgb((int)(r / count), (int)(g / count), (int)(b / count));
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"
$sourcePath = Join-Path $assets "razane-omori-reference.png"
$sourceBitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)

$poses = @(
  @{ Name = "front"; CenterX = 834; CenterY = 104; Width = 136; Height = 176; Tolerance = 210; MinSize = 18 },
  @{ Name = "back"; CenterX = 834; CenterY = 300; Width = 152; Height = 208; Tolerance = 160; MinSize = 44 },
  @{ Name = "left"; CenterX = 834; CenterY = 482; Width = 136; Height = 176; Tolerance = 210; MinSize = 18 },
  @{ Name = "right"; CenterX = 834; CenterY = 672; Width = 136; Height = 176; Tolerance = 210; MinSize = 18 }
)

try {
  foreach ($pose in $poses) {
    $x = [int]($pose.CenterX - ($pose.Width / 2))
    $y = [int]($pose.CenterY - ($pose.Height / 2))
    $rect = [System.Drawing.Rectangle]::new([int]$x, [int]$y, [int]$pose.Width, [int]$pose.Height)
    $frame = [RazanePoseTools]::Crop($sourceBitmap, $rect)

    try {
      [RazanePoseTools]::ClearEdgeBackground($frame, [int]$pose.Tolerance)
      [RazanePoseTools]::RemoveSmallOpaqueRegions($frame, [int]$pose.MinSize)
      $trimmed = [RazanePoseTools]::Trim($frame, 2)

      try {
        $outPath = Join-Path $assets ("razane-" + $pose.Name + ".png")
        $trimmed.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
      }
      finally {
        $trimmed.Dispose()
      }
    }
    finally {
      $frame.Dispose()
    }
  }
}
finally {
  $sourceBitmap.Dispose()
}

Write-Output "Created standalone Razane poses in $assets"
