$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class AssetImageTools
{
    public static void RemoveEdgeConnectedBackground(string inputPath, string outputPath, int tolerance, bool trim)
    {
        using (var source = (Bitmap)Image.FromFile(inputPath))
        using (var bitmap = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.DrawImage(source, 0, 0, source.Width, source.Height);
            }

            ClearBackground(bitmap, tolerance);

            using (var result = trim ? TrimTransparent(bitmap) : (Bitmap)bitmap.Clone())
            {
                result.Save(outputPath, ImageFormat.Png);
            }
        }
    }

    private static void ClearBackground(Bitmap bitmap, int tolerance)
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

            var borderColor = AverageBorderColor(pixels, width, height, stride);
            bool[] visited = new bool[width * height];
            Queue<int> queue = new Queue<int>();

            Action<int, int> tryEnqueue = (x, y) =>
            {
                if (x < 0 || y < 0 || x >= width || y >= height)
                {
                    return;
                }

                int flatIndex = y * width + x;
                if (visited[flatIndex])
                {
                    return;
                }

                visited[flatIndex] = true;
                int offset = y * stride + x * 4;
                byte alpha = pixels[offset + 3];
                if (alpha == 0)
                {
                    return;
                }

                int distance =
                    Math.Abs(pixels[offset + 2] - borderColor.R) +
                    Math.Abs(pixels[offset + 1] - borderColor.G) +
                    Math.Abs(pixels[offset + 0] - borderColor.B);

                if (distance > tolerance)
                {
                    return;
                }

                queue.Enqueue(flatIndex);
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
                int flatIndex = queue.Dequeue();
                int x = flatIndex % width;
                int y = flatIndex / width;
                int offset = y * stride + x * 4;
                pixels[offset + 0] = 0;
                pixels[offset + 1] = 0;
                pixels[offset + 2] = 0;
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

    private static Color AverageBorderColor(byte[] pixels, int width, int height, int stride)
    {
        long red = 0;
        long green = 0;
        long blue = 0;
        long count = 0;

        Action<int, int> read = (x, y) =>
        {
            int offset = y * stride + x * 4;
            red += pixels[offset + 2];
            green += pixels[offset + 1];
            blue += pixels[offset + 0];
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

        return Color.FromArgb(
            (int)(red / count),
            (int)(green / count),
            (int)(blue / count)
        );
    }

    private static Bitmap TrimTransparent(Bitmap bitmap)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);

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
                    int alpha = pixels[y * stride + x * 4 + 3];
                    if (alpha == 0)
                    {
                        continue;
                    }

                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }

            if (maxX < minX || maxY < minY)
            {
                return new Bitmap(bitmap);
            }

            Rectangle crop = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
            return bitmap.Clone(crop, PixelFormat.Format32bppArgb);
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"

[AssetImageTools]::RemoveEdgeConnectedBackground(
  (Join-Path $assets "razane-sheet.jpeg"),
  (Join-Path $assets "razane-sheet-processed.png"),
  75,
  $false
)

[AssetImageTools]::RemoveEdgeConnectedBackground(
  (Join-Path $assets "room-reference.png"),
  (Join-Path $assets "room-reference-processed.png"),
  75,
  $true
)

Write-Output "Processed assets written to $assets"
