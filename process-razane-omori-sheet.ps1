$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class OmoriSpriteTools
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

    public static void DrawCentered(Bitmap target, Bitmap sprite, Rectangle slot)
    {
        using (Graphics graphics = Graphics.FromImage(target))
        {
            graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
            graphics.PixelOffsetMode = PixelOffsetMode.Half;
            int x = slot.X + (slot.Width - sprite.Width) / 2;
            int y = slot.Y + slot.Height - sprite.Height - 2;
            graphics.DrawImage(sprite, x, y, sprite.Width, sprite.Height);
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
$outPath = Join-Path $assets "razane-omori-sprites.png"

$cellWidth = 72
$cellHeight = 110
$sheet = [System.Drawing.Bitmap]::new(
  [int]($cellWidth * 5),
  [int]($cellHeight * 4),
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)

$centersX = @(342, 588, 834, 1080, 1326)
$centersY = @(110, 250, 482, 672)
$cropWidth = 124
$cropHeight = 180

$sourceBitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)

try {
  for ($row = 0; $row -lt 4; $row += 1) {
    for ($col = 0; $col -lt 5; $col += 1) {
      $x = [int]($centersX[$col] - ($cropWidth / 2))
      $y = [int]($centersY[$row] - ($cropHeight / 2))
      $rect = [System.Drawing.Rectangle]::new([int]$x, [int]$y, [int]$cropWidth, [int]$cropHeight)
      $frame = [OmoriSpriteTools]::Crop($sourceBitmap, $rect)

      try {
        $tolerance = if ($row -eq 1) { 130 } else { 200 }
        [OmoriSpriteTools]::ClearEdgeBackground($frame, $tolerance)
        $trimmed = [OmoriSpriteTools]::Trim($frame, 1)

        try {
          $slot = [System.Drawing.Rectangle]::new(
            [int]($col * $cellWidth),
            [int]($row * $cellHeight),
            [int]$cellWidth,
            [int]$cellHeight
          )
          [OmoriSpriteTools]::DrawCentered($sheet, $trimmed, $slot)
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

  $sheet.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $sourceBitmap.Dispose()
  $sheet.Dispose()
}

Write-Output "Created $outPath"
